import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.argv[2] || 'preview';
const envName = target.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'PREVIEW';
const url = process.env[`DATABASE_URL_${envName}`] || (envName === 'PRODUCTION' ? process.env.DATABASE_URL : '');

if (!url) {
  console.error(`DATABASE_URL_${envName} is not set`);
  process.exit(1);
}

const initialPassword = process.env.GW_INITIAL_ADMIN_PASSWORD || '1234';
const salt = process.env.GW_INITIAL_ADMIN_PASSWORD_SALT || randomBytes(16).toString('hex');
const passwordHash = `sha256:${salt}:${createHash('sha256').update(`${salt}:${initialPassword}`).digest('hex')}`;
const now = new Date().toISOString();

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const sql = `
begin;

insert into companies (id, name, status, created_at, updated_at)
values ('company_demo', '데모 주식회사', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into branches (id, company_id, code, name, branch_type, status, created_at, updated_at)
values
  ('branch_hq', 'company_demo', 'HQ', '본사 운영센터', 'office', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('branch_hotel_seoul', 'company_demo', 'SEL', '서울 시티 호텔', 'hotel', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into departments (id, company_id, branch_id, code, name, status, created_at, updated_at)
values
  ('department_exec', 'company_demo', 'branch_hq', 'EXEC', '경영지원', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('department_ops', 'company_demo', 'branch_hotel_seoul', 'OPS', '운영팀', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('department_hr', 'company_demo', 'branch_hq', 'HR', '인사팀', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into positions (id, company_id, code, name, rank_order, status, created_at, updated_at)
values
  ('position_admin', 'company_demo', 'ADMIN', '관리자', 100, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('position_staff', 'company_demo', 'STAFF', '구성원', 10, 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into users (id, company_id, login_id, email, password_hash, display_name, status, must_change_password, created_at, updated_at)
values
  ('user_company_admin', 'company_demo', 'admin', 'admin@example.com', ${sqlString(passwordHash)}, '관리자 테스트', 'active', true, ${sqlString(now)}, ${sqlString(now)}),
  ('user_hr_admin', 'company_demo', 'hr-admin', 'staff@example.com', ${sqlString(passwordHash)}, '인사 담당자', 'active', true, ${sqlString(now)}, ${sqlString(now)}),
  ('user_manager', 'company_demo', 'manager', 'manager@example.com', ${sqlString(passwordHash)}, '운영 매니저', 'active', true, ${sqlString(now)}, ${sqlString(now)}),
  ('user_employee', 'company_demo', 'employee', 'employee@example.com', ${sqlString(passwordHash)}, '일반 구성원', 'active', true, ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, login_id) do update set password_hash = excluded.password_hash, must_change_password = true, updated_at = excluded.updated_at;

insert into employees (id, company_id, branch_id, user_id, department_id, position_id, employee_number, full_name, employment_status, hire_date, created_at, updated_at)
values
  ('employee_admin', 'company_demo', 'branch_hq', 'user_company_admin', 'department_exec', 'position_admin', 'A-0001', '관리자 테스트', 'active', current_date, ${sqlString(now)}, ${sqlString(now)}),
  ('employee_staff', 'company_demo', 'branch_hq', 'user_hr_admin', 'department_hr', 'position_staff', 'A-0002', '인사 담당자', 'on_leave', current_date, ${sqlString(now)}, ${sqlString(now)}),
  ('employee_manager', 'company_demo', 'branch_hotel_seoul', 'user_manager', 'department_ops', 'position_staff', 'A-0003', '운영 매니저', 'active', current_date, ${sqlString(now)}, ${sqlString(now)}),
  ('employee_employee', 'company_demo', 'branch_hotel_seoul', 'user_employee', 'department_ops', 'position_staff', 'A-0004', '일반 구성원', 'active', current_date, ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, employee_number) do update set user_id = excluded.user_id, branch_id = excluded.branch_id, department_id = excluded.department_id, employment_status = excluded.employment_status, updated_at = excluded.updated_at;

insert into roles (id, company_id, code, name, role_scope, status, created_at, updated_at)
values
  ('role_company_admin', 'company_demo', 'COMPANY_ADMIN', '회사 운영 총괄', 'company', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('role_hr_admin', 'company_demo', 'HR_ADMIN', '인사 운영', 'company', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('role_manager', 'company_demo', 'MANAGER', '팀 운영', 'company', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('role_employee', 'company_demo', 'EMPLOYEE', '일반 구성원', 'company', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('role_auditor', 'company_demo', 'AUDITOR', '감사 조회', 'audit', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, role_scope = excluded.role_scope, updated_at = excluded.updated_at;

insert into permissions (id, code, name, permission_group, created_at)
values
  ('permission_company_read', 'company.read', '회사 조회', 'org', ${sqlString(now)}),
  ('permission_employee_read', 'employee.read', '직원 조회', 'org', ${sqlString(now)}),
  ('permission_employee_write', 'employee.write', '직원 수정', 'org', ${sqlString(now)}),
  ('permission_department_read', 'department.read', '부서 조회', 'org', ${sqlString(now)}),
  ('permission_role_read', 'role.read', '역할 조회', 'org', ${sqlString(now)}),
  ('permission_permission_read', 'permission.read', '권한 조회', 'org', ${sqlString(now)}),
  ('permission_audit_read', 'audit.read', '감사 조회', 'admin', ${sqlString(now)}),
  ('permission_invite_manage', 'invite.manage', '초대 관리', 'admin', ${sqlString(now)}),
  ('permission_attendance_read', 'attendance.read', '근태 조회', 'attendance', ${sqlString(now)}),
  ('permission_leave_request', 'leave.request', '휴가 신청', 'leave', ${sqlString(now)}),
  ('permission_leave_manage', 'leave.manage', '휴가 관리', 'leave', ${sqlString(now)}),
  ('permission_payroll_read', 'payroll.read', '급여 조회', 'payroll', ${sqlString(now)}),
  ('permission_payroll_manage', 'payroll.manage', '급여 관리', 'payroll', ${sqlString(now)}),
  ('permission_payroll_review', 'payroll.review', '급여 검토', 'payroll', ${sqlString(now)}),
  ('permission_payroll_payslip_read_self', 'payroll.payslip.read_self', '본인 급여명세서 조회', 'payroll', ${sqlString(now)}),
  ('permission_approval_form_manage', 'approval.form.manage', '결재양식 관리', 'approval', ${sqlString(now)}),
  ('permission_approval_line_manage', 'approval.line.manage', '결재선 관리', 'approval', ${sqlString(now)}),
  ('permission_approval_document_read', 'approval.document.read', '결재문서 조회', 'approval', ${sqlString(now)}),
  ('permission_approval_document_write', 'approval.document.write', '결재문서 작성', 'approval', ${sqlString(now)}),
  ('permission_approval_document_approve', 'approval.document.approve', '결재 승인', 'approval', ${sqlString(now)}),
  ('permission_board_notice_read', 'board.notice.read', '공지 조회', 'board', ${sqlString(now)}),
  ('permission_board_manage', 'board.manage', '게시판 관리', 'board', ${sqlString(now)}),
  ('permission_board_post_write', 'board.post.write', '게시글 작성', 'board', ${sqlString(now)}),
  ('permission_board_comment_write', 'board.comment.write', '댓글 작성', 'board', ${sqlString(now)}),
  ('permission_document_space_read', 'document.space.read', '문서함 조회', 'document', ${sqlString(now)}),
  ('permission_document_space_manage', 'document.space.manage', '문서함 관리', 'document', ${sqlString(now)}),
  ('permission_document_file_read', 'document.file.read', '문서 파일 조회', 'document', ${sqlString(now)}),
  ('permission_document_file_write', 'document.file.write', '문서 파일 작성', 'document', ${sqlString(now)}),
  ('permission_work_item_read', 'work_item.read', '업무 조회', 'work_item', ${sqlString(now)}),
  ('permission_work_item_manage', 'work_item.manage', '업무 관리', 'work_item', ${sqlString(now)}),
  ('permission_work_item_review', 'work_item.review', '업무 검토', 'work_item', ${sqlString(now)}),
  ('permission_work_item_deadline_read', 'work_item.deadline.read', '업무 마감 조회', 'work_item', ${sqlString(now)}),
  ('permission_work_item_audit_read', 'work_item.audit.read', '업무 감사 조회', 'work_item', ${sqlString(now)}),
  ('permission_work_item_grievance_read_restricted', 'work_item.grievance.read_restricted', '제한 고충 조회', 'work_item', ${sqlString(now)}),
  ('permission_work_item_labor_read_restricted', 'work_item.labor.read_restricted', '제한 노무 조회', 'work_item', ${sqlString(now)})
on conflict (code) do update set name = excluded.name, permission_group = excluded.permission_group;

insert into role_permissions (id, role_id, permission_id, created_at)
values
  ('rp_company_admin_company_read', 'role_company_admin', 'permission_company_read', ${sqlString(now)}),
  ('rp_company_admin_employee_read', 'role_company_admin', 'permission_employee_read', ${sqlString(now)}),
  ('rp_company_admin_employee_write', 'role_company_admin', 'permission_employee_write', ${sqlString(now)}),
  ('rp_company_admin_department_read', 'role_company_admin', 'permission_department_read', ${sqlString(now)}),
  ('rp_company_admin_role_read', 'role_company_admin', 'permission_role_read', ${sqlString(now)}),
  ('rp_company_admin_permission_read', 'role_company_admin', 'permission_permission_read', ${sqlString(now)}),
  ('rp_company_admin_audit_read', 'role_company_admin', 'permission_audit_read', ${sqlString(now)}),
  ('rp_company_admin_invite_manage', 'role_company_admin', 'permission_invite_manage', ${sqlString(now)}),
  ('rp_company_admin_attendance_read', 'role_company_admin', 'permission_attendance_read', ${sqlString(now)}),
  ('rp_company_admin_leave_request', 'role_company_admin', 'permission_leave_request', ${sqlString(now)}),
  ('rp_company_admin_leave_manage', 'role_company_admin', 'permission_leave_manage', ${sqlString(now)}),
  ('rp_company_admin_payroll_read', 'role_company_admin', 'permission_payroll_read', ${sqlString(now)}),
  ('rp_company_admin_payroll_manage', 'role_company_admin', 'permission_payroll_manage', ${sqlString(now)}),
  ('rp_company_admin_payroll_review', 'role_company_admin', 'permission_payroll_review', ${sqlString(now)}),
  ('rp_company_admin_payroll_payslip_self', 'role_company_admin', 'permission_payroll_payslip_read_self', ${sqlString(now)}),
  ('rp_company_admin_approval_form_manage', 'role_company_admin', 'permission_approval_form_manage', ${sqlString(now)}),
  ('rp_company_admin_approval_line_manage', 'role_company_admin', 'permission_approval_line_manage', ${sqlString(now)}),
  ('rp_company_admin_approval_document_read', 'role_company_admin', 'permission_approval_document_read', ${sqlString(now)}),
  ('rp_company_admin_approval_document_write', 'role_company_admin', 'permission_approval_document_write', ${sqlString(now)}),
  ('rp_company_admin_approval_document_approve', 'role_company_admin', 'permission_approval_document_approve', ${sqlString(now)}),
  ('rp_company_admin_board_notice_read', 'role_company_admin', 'permission_board_notice_read', ${sqlString(now)}),
  ('rp_company_admin_board_manage', 'role_company_admin', 'permission_board_manage', ${sqlString(now)}),
  ('rp_company_admin_board_post_write', 'role_company_admin', 'permission_board_post_write', ${sqlString(now)}),
  ('rp_company_admin_board_comment_write', 'role_company_admin', 'permission_board_comment_write', ${sqlString(now)}),
  ('rp_company_admin_document_space_read', 'role_company_admin', 'permission_document_space_read', ${sqlString(now)}),
  ('rp_company_admin_document_space_manage', 'role_company_admin', 'permission_document_space_manage', ${sqlString(now)}),
  ('rp_company_admin_document_file_read', 'role_company_admin', 'permission_document_file_read', ${sqlString(now)}),
  ('rp_company_admin_document_file_write', 'role_company_admin', 'permission_document_file_write', ${sqlString(now)}),
  ('rp_company_admin_work_item_read', 'role_company_admin', 'permission_work_item_read', ${sqlString(now)}),
  ('rp_company_admin_work_item_manage', 'role_company_admin', 'permission_work_item_manage', ${sqlString(now)}),
  ('rp_company_admin_work_item_review', 'role_company_admin', 'permission_work_item_review', ${sqlString(now)}),
  ('rp_company_admin_work_item_deadline_read', 'role_company_admin', 'permission_work_item_deadline_read', ${sqlString(now)}),
  ('rp_company_admin_work_item_audit_read', 'role_company_admin', 'permission_work_item_audit_read', ${sqlString(now)}),
  ('rp_company_admin_work_item_grievance_read_restricted', 'role_company_admin', 'permission_work_item_grievance_read_restricted', ${sqlString(now)}),
  ('rp_company_admin_work_item_labor_read_restricted', 'role_company_admin', 'permission_work_item_labor_read_restricted', ${sqlString(now)}),
  ('rp_hr_admin_company_read', 'role_hr_admin', 'permission_company_read', ${sqlString(now)}),
  ('rp_hr_admin_employee_read', 'role_hr_admin', 'permission_employee_read', ${sqlString(now)}),
  ('rp_hr_admin_department_read', 'role_hr_admin', 'permission_department_read', ${sqlString(now)}),
  ('rp_hr_admin_role_read', 'role_hr_admin', 'permission_role_read', ${sqlString(now)}),
  ('rp_hr_admin_permission_read', 'role_hr_admin', 'permission_permission_read', ${sqlString(now)}),
  ('rp_hr_admin_attendance_read', 'role_hr_admin', 'permission_attendance_read', ${sqlString(now)}),
  ('rp_hr_admin_leave_request', 'role_hr_admin', 'permission_leave_request', ${sqlString(now)}),
  ('rp_hr_admin_leave_manage', 'role_hr_admin', 'permission_leave_manage', ${sqlString(now)}),
  ('rp_hr_admin_payroll_read', 'role_hr_admin', 'permission_payroll_read', ${sqlString(now)}),
  ('rp_hr_admin_payroll_review', 'role_hr_admin', 'permission_payroll_review', ${sqlString(now)}),
  ('rp_hr_admin_approval_document_read', 'role_hr_admin', 'permission_approval_document_read', ${sqlString(now)}),
  ('rp_hr_admin_board_notice_read', 'role_hr_admin', 'permission_board_notice_read', ${sqlString(now)}),
  ('rp_hr_admin_document_space_read', 'role_hr_admin', 'permission_document_space_read', ${sqlString(now)}),
  ('rp_hr_admin_document_file_read', 'role_hr_admin', 'permission_document_file_read', ${sqlString(now)}),
  ('rp_hr_admin_work_item_read', 'role_hr_admin', 'permission_work_item_read', ${sqlString(now)}),
  ('rp_hr_admin_work_item_review', 'role_hr_admin', 'permission_work_item_review', ${sqlString(now)}),
  ('rp_hr_admin_work_item_deadline_read', 'role_hr_admin', 'permission_work_item_deadline_read', ${sqlString(now)}),
  ('rp_manager_company_read', 'role_manager', 'permission_company_read', ${sqlString(now)}),
  ('rp_manager_employee_read', 'role_manager', 'permission_employee_read', ${sqlString(now)}),
  ('rp_manager_department_read', 'role_manager', 'permission_department_read', ${sqlString(now)}),
  ('rp_manager_role_read', 'role_manager', 'permission_role_read', ${sqlString(now)}),
  ('rp_manager_permission_read', 'role_manager', 'permission_permission_read', ${sqlString(now)}),
  ('rp_manager_attendance_read', 'role_manager', 'permission_attendance_read', ${sqlString(now)}),
  ('rp_manager_leave_request', 'role_manager', 'permission_leave_request', ${sqlString(now)}),
  ('rp_manager_approval_document_read', 'role_manager', 'permission_approval_document_read', ${sqlString(now)}),
  ('rp_manager_approval_document_approve', 'role_manager', 'permission_approval_document_approve', ${sqlString(now)}),
  ('rp_manager_board_notice_read', 'role_manager', 'permission_board_notice_read', ${sqlString(now)}),
  ('rp_manager_board_post_write', 'role_manager', 'permission_board_post_write', ${sqlString(now)}),
  ('rp_manager_board_comment_write', 'role_manager', 'permission_board_comment_write', ${sqlString(now)}),
  ('rp_manager_document_space_read', 'role_manager', 'permission_document_space_read', ${sqlString(now)}),
  ('rp_manager_document_file_read', 'role_manager', 'permission_document_file_read', ${sqlString(now)}),
  ('rp_manager_work_item_read', 'role_manager', 'permission_work_item_read', ${sqlString(now)}),
  ('rp_manager_work_item_review', 'role_manager', 'permission_work_item_review', ${sqlString(now)}),
  ('rp_manager_work_item_deadline_read', 'role_manager', 'permission_work_item_deadline_read', ${sqlString(now)}),
  ('rp_employee_company_read', 'role_employee', 'permission_company_read', ${sqlString(now)}),
  ('rp_employee_employee_read', 'role_employee', 'permission_employee_read', ${sqlString(now)}),
  ('rp_employee_department_read', 'role_employee', 'permission_department_read', ${sqlString(now)}),
  ('rp_employee_role_read', 'role_employee', 'permission_role_read', ${sqlString(now)}),
  ('rp_employee_permission_read', 'role_employee', 'permission_permission_read', ${sqlString(now)}),
  ('rp_employee_attendance_read', 'role_employee', 'permission_attendance_read', ${sqlString(now)}),
  ('rp_employee_leave_request', 'role_employee', 'permission_leave_request', ${sqlString(now)}),
  ('rp_employee_approval_document_read', 'role_employee', 'permission_approval_document_read', ${sqlString(now)}),
  ('rp_employee_approval_document_write', 'role_employee', 'permission_approval_document_write', ${sqlString(now)}),
  ('rp_employee_board_notice_read', 'role_employee', 'permission_board_notice_read', ${sqlString(now)}),
  ('rp_employee_board_post_write', 'role_employee', 'permission_board_post_write', ${sqlString(now)}),
  ('rp_employee_board_comment_write', 'role_employee', 'permission_board_comment_write', ${sqlString(now)}),
  ('rp_employee_document_space_read', 'role_employee', 'permission_document_space_read', ${sqlString(now)}),
  ('rp_employee_document_file_read', 'role_employee', 'permission_document_file_read', ${sqlString(now)}),
  ('rp_employee_payroll_payslip_self', 'role_employee', 'permission_payroll_payslip_read_self', ${sqlString(now)}),
  ('rp_employee_work_item_read', 'role_employee', 'permission_work_item_read', ${sqlString(now)}),
  ('rp_employee_work_item_deadline_read', 'role_employee', 'permission_work_item_deadline_read', ${sqlString(now)}),
  ('rp_auditor_company_read', 'role_auditor', 'permission_company_read', ${sqlString(now)}),
  ('rp_auditor_employee_read', 'role_auditor', 'permission_employee_read', ${sqlString(now)}),
  ('rp_auditor_department_read', 'role_auditor', 'permission_department_read', ${sqlString(now)}),
  ('rp_auditor_role_read', 'role_auditor', 'permission_role_read', ${sqlString(now)}),
  ('rp_auditor_permission_read', 'role_auditor', 'permission_permission_read', ${sqlString(now)}),
  ('rp_auditor_audit_read', 'role_auditor', 'permission_audit_read', ${sqlString(now)}),
  ('rp_auditor_board_notice_read', 'role_auditor', 'permission_board_notice_read', ${sqlString(now)}),
  ('rp_auditor_document_space_read', 'role_auditor', 'permission_document_space_read', ${sqlString(now)}),
  ('rp_auditor_document_file_read', 'role_auditor', 'permission_document_file_read', ${sqlString(now)}),
  ('rp_auditor_work_item_read', 'role_auditor', 'permission_work_item_read', ${sqlString(now)}),
  ('rp_auditor_work_item_audit_read', 'role_auditor', 'permission_work_item_audit_read', ${sqlString(now)}),
  ('rp_auditor_work_item_grievance_read_restricted', 'role_auditor', 'permission_work_item_grievance_read_restricted', ${sqlString(now)}),
  ('rp_auditor_work_item_labor_read_restricted', 'role_auditor', 'permission_work_item_labor_read_restricted', ${sqlString(now)})
on conflict (role_id, permission_id) do update set created_at = excluded.created_at;

insert into user_roles (id, company_id, user_id, role_id, branch_id, assigned_by, status, created_at, updated_at)
values
  ('user_role_company_admin', 'company_demo', 'user_company_admin', 'role_company_admin', 'branch_hq', 'user_company_admin', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('user_role_hr_admin', 'company_demo', 'user_hr_admin', 'role_hr_admin', 'branch_hq', 'user_company_admin', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('user_role_manager', 'company_demo', 'user_manager', 'role_manager', 'branch_hotel_seoul', 'user_company_admin', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('user_role_employee', 'company_demo', 'user_employee', 'role_employee', 'branch_hotel_seoul', 'user_company_admin', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, user_id, role_id, branch_id) do update set status = 'active', updated_at = excluded.updated_at;

insert into home_shortcuts (id, company_id, user_id, code, label, href, icon, is_fixed, sort_order, status, created_at, updated_at)
values
  ('shortcut_attendance', 'company_demo', null, 'attendance', '출퇴근 먼저', '/attendance', 'clock', true, 10, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_leave', 'company_demo', null, 'leave', '휴가 확인', '/leave', 'calendar', true, 20, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_approvals', 'company_demo', null, 'approvals', '결재 대기', '/approvals', 'stamp', true, 30, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_boards', 'company_demo', null, 'boards', '공지/게시판', '/boards', 'megaphone', true, 40, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_documents', 'company_demo', null, 'documents', '문서함', '/documents', 'folder', true, 50, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_me', 'company_demo', null, 'me', '내 정보', '/me', 'user', true, 60, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_admin_users_company_admin', 'company_demo', 'user_company_admin', 'admin_users', '관리자 사용자', '/admin/users', 'shield', false, 110, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('shortcut_audit_logs_company_admin', 'company_demo', 'user_company_admin', 'audit_logs', '감사 로그', '/admin/audit-logs', 'history', false, 120, 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (id) do update set label = excluded.label, href = excluded.href, icon = excluded.icon, is_fixed = excluded.is_fixed, sort_order = excluded.sort_order, status = excluded.status, updated_at = excluded.updated_at;

delete from notifications
where id in ('notification_admin_seed_1', 'notification_admin_seed_2', 'notification_hr_seed_1');

insert into notifications (id, company_id, user_id, title, body, notification_type, read_at, created_at)
values
  ('notification_admin_operational_ready', 'company_demo', 'user_company_admin', '운영 알림 수신함 준비', '관리자 바로가기와 감사 로그를 같은 화면 흐름에서 확인할 수 있습니다.', 'system', null, ${sqlString(now)}),
  ('notification_admin_audit_review', 'company_demo', 'user_company_admin', '감사 로그 재확인 필요', '관리자 권한 변경 이력은 /admin/audit-logs 에서 마스킹된 상태로 확인합니다.', 'audit', ${sqlString(now)}, ${sqlString(now)}),
  ('notification_hr_directory_review', 'company_demo', 'user_hr_admin', '인사 검토 대기', '직원 디렉터리와 부서 구조를 운영 DB 기준으로 확인할 수 있습니다.', 'hr', null, ${sqlString(now)})
on conflict (id) do update set title = excluded.title, body = excluded.body, notification_type = excluded.notification_type, read_at = excluded.read_at;

insert into audit_logs (id, company_id, branch_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
values
  ('audit_initial_seed_admin', 'company_demo', 'branch_hq', 'user_company_admin', 'db.initial_seed.admin', 'user', 'user_company_admin', null, null, '{"reason":"초기 관리자 seed 완료","category":"user","maskedFields":["mustChangePassword"],"source":"api-admin"}'::jsonb, ${sqlString(now)}),
  ('audit_admin_notification_review', 'company_demo', 'branch_hq', 'user_company_admin', 'admin.notification.list.viewed', 'audit_log', 'notification_admin_operational_ready', null, null, '{"reason":"알림 inbox 운영 점검","category":"audit","maskedFields":["notification body 일부"],"source":"web-admin"}'::jsonb, ${sqlString(now)}),
  ('audit_policy_document_scope_seed', 'company_demo', 'branch_hq', 'user_hr_admin', 'admin.policy.document.updated', 'document_policy', 'policy_documents_default', '{"visibility":"team"}'::jsonb, '{"visibility":"company"}'::jsonb, '{"reason":"문서 정책 preview seed","category":"policy","maskedFields":["storage reference","download link"],"source":"api-admin"}'::jsonb, ${sqlString(now)})
on conflict (id) do update set action = excluded.action, resource_type = excluded.resource_type, resource_id = excluded.resource_id, before_json = excluded.before_json, after_json = excluded.after_json, metadata_json = excluded.metadata_json;

commit;
`;

const dir = mkdtempSync(join(tmpdir(), 'gw-seed-'));
const file = join(dir, 'seed.sql');
writeFileSync(file, sql);
const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8' });
rmSync(dir, { recursive: true, force: true });

if (result.status !== 0) {
  console.error(result.stderr.replace(/postgresql:\/\/\S+/g, '[REDACTED_URL]'));
  process.exit(result.status ?? 1);
}

console.log(`초기 관리자 seed 완료: target=${envName}, loginId=admin, mustChangePassword=true`);
