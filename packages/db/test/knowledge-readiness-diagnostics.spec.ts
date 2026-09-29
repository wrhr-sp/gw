import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
const source=readFileSync(new URL('../src/client.ts',import.meta.url),'utf8');
const tree=ts.createSourceFile('client.ts',source,ts.ScriptTarget.Latest,true);
let helper='';let gate='';const bindings:string[]=[];
function visit(node: ts.Node) {
 if(ts.isVariableDeclaration(node)) {
  const name=node.name.getText(tree);
  if(name==='schemaNotReady')helper=node.getText(tree);
  if(['HOTEL_KNOWLEDGE_CORE_EXPAND_CATALOG_SHA256','HOTEL_KNOWLEDGE_CORE_CONTRACT_CATALOG_SHA256','knowledgeServerMajor','expectedKnowledgeCatalogDigest'].includes(name))bindings.push(`const ${node.getText(tree)};`);
 }
 if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('knowledgeFoundation?.knowledge_table_count !== 4')&&node.expression.getText(tree).includes('knowledgeCatalogDigest !== expectedKnowledgeCatalogDigest'))gate=node.getText(tree);
 ts.forEachChild(node,visit);
}
visit(tree);
function reporter(observer?: (s:string)=>unknown) {
 expect(helper).not.toBe('');
 const code=ts.transpileModule(`const ${helper};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('options',`${code};return schemaNotReady;`)({onSchemaNotReady:observer});
}
const digests={16:{core:'2b80658a2baa6a8409ca0f7f42adfd7943d020d0e89f44dbe6acbc9da92448de',attachments:'219f76050f31f5cd6b9448d26999f3baef47d34dd67a43b6d3e14fe728e53bb3'},18:{core:'21902440bb16ba8a8b5948bb7e518f4643fefc9517cd88e8d1c4e132458845f8',attachments:'c0f2c583f8a9fd9ed5dda976f984dd7402ba3705d02a899830e178012e4073fd'}};
const counts={knowledge_table_count:4,knowledge_owner_safe_count:4,knowledge_rls_count:4,knowledge_force_rls_count:4,knowledge_policy_count:4,knowledge_policy_total_count:4,knowledge_acl_count:0,knowledge_column_acl_count:0,knowledge_function_count:19,knowledge_function_acl_count:5,knowledge_function_acl_safe_count:5,knowledge_function_execute_count:5,knowledge_index_count:7,knowledge_pg_trgm_count:1,knowledge_trigger_count:3,knowledge_column_shape_count:10,server_version_num:180001};
function runGate(row: typeof counts, catalog:string|null, phase='EXPAND',observe=vi.fn()) {
 expect(gate).not.toBe('');expect(bindings.length).toBeGreaterThanOrEqual(3);
 const code=ts.transpileModule(bindings.join('\n')+gate,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('knowledgeFoundation','knowledgeCatalogDigest','knowledgeSourceDigest','expectedKnowledgeSourceDigest','expectedKnowledgeExecuteCount','knowledgeAttachmentsPhase','schemaNotReady',`${code};return {status:'READY'};`)(row,catalog,'b'.repeat(64),'b'.repeat(64),5,phase,reporter(observe));
}
describe('knowledge attachments exact engine binding',()=>{
 const row={table_count:2,owner_safe_count:2,rls_count:2,force_rls_count:2,policy_count:2,policy_total_count:2,acl_count:0,column_acl_count:0,function_count:7,function_acl_count:5,function_acl_safe_count:5,execute_count:5,branch_nullable_count:4,knowledge_parent_column_count:2,action_constraint_count:1,trigger_count:1,server_version_num:180001};
 const hashes={16:'9383de30511036a8c03e65655c18f667593ce309e3e1aca72edebff6ca3c7720',18:'fffb11fe1167db3e50bf6eee24e473286f48d4d697e5bbb2cdd953d53c2bd566'};
 function runAttachment(input:typeof row,digest:string|null,badSource=false){
  const statements:string[]=[];let attachmentGate='';
  function scan(node:ts.Node){
   if(ts.isVariableDeclaration(node)&&['HOTEL_KNOWLEDGE_ATTACHMENTS_CATALOG_SHA256','HOTEL_KNOWLEDGE_ATTACHMENTS_PROSRC_SHA256','attachmentServerMajor','expectedAttachmentCatalogDigest'].includes(node.name.getText(tree)))statements.push(`const ${node.getText(tree)};`);
   if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('attachmentFoundation?.table_count !== 2'))attachmentGate=node.getText(tree);
   ts.forEachChild(node,scan);
  }
  scan(tree);expect(attachmentGate).not.toBe('');expect(statements.length).toBeGreaterThanOrEqual(2);
  const code=ts.transpileModule(statements.join('\n')+`const attachmentSourceDigest=badSource?'invalid':HOTEL_KNOWLEDGE_ATTACHMENTS_PROSRC_SHA256;`+attachmentGate,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function('attachmentFoundation','attachmentCatalogDigest','badSource','expectedAttachmentExecuteCount','schemaNotReady',`${code};return {status:'READY'};`)(input,digest,badSource,5,reporter());
 }
 it.each([16,18] as const)('accepts only the measured PG%s attachment catalog',major=>{
  const input={...row,server_version_num:major*10000+15};
  expect(runAttachment(input,hashes[major])).toEqual({status:'READY'});
  expect(runAttachment(input,hashes[major===16?18:16])).toEqual({status:'SCHEMA_NOT_READY'});
  expect(runAttachment(input,'0'.repeat(64))).toEqual({status:'SCHEMA_NOT_READY'});
  expect(runAttachment(input,hashes[major],true)).toEqual({status:'SCHEMA_NOT_READY'});
 });
 it.each([0,150000,170000,190000,NaN])('rejects unverified attachment version %s',version=>{
  for(const hash of [null,hashes[16],hashes[18]])expect(runAttachment({...row,server_version_num:version},hash)).toEqual({status:'SCHEMA_NOT_READY'});
 });
 it.each(Object.keys(row).filter(k=>k!=='server_version_num'))('preserves attachment rejection of damaged %s',key=>{
  for(const major of [16,18] as const)expect(runAttachment({...row,server_version_num:major*10000,[key]:999},hashes[major])).toEqual({status:'SCHEMA_NOT_READY'});
 });
});
describe('knowledge readiness exact engine and phase binding',()=>{
 for(const major of [16,18] as const)for(const phase of ['core','attachments'] as const){
  it(`accepts independently reproduced PG${major} ${phase} only`,()=>{
   const row={...counts,server_version_num:major*10000+15};const lifecycle=phase==='attachments'?'EXPAND':'PRE_EXPAND';
   expect(runGate(row,digests[major][phase],lifecycle)).toEqual({status:'READY'});
   expect(runGate(row,digests[major===16?18:16][phase],lifecycle)).toEqual({status:'SCHEMA_NOT_READY'});
   expect(runGate(row,digests[major][phase==='core'?'attachments':'core'],lifecycle)).toEqual({status:'SCHEMA_NOT_READY'});
   expect(runGate(row,'0'.repeat(64),lifecycle)).toEqual({status:'SCHEMA_NOT_READY'});
  });
 }
 it.each([0,150000,170000,190000,NaN])('rejects unverified server version %s',version=>{
  for(const digest of [null,digests[16].attachments,digests[18].attachments])expect(runGate({...counts,server_version_num:version},digest)).toEqual({status:'SCHEMA_NOT_READY'});
 });
 it('removes temporary catalog and dimension output',()=>{
  expect(source).not.toContain('KNOWLEDGE_CATALOG_SHA256_');expect(source).not.toContain('KNOWLEDGE_CATALOG_MISMATCH');
  expect(source).toContain("current_setting('server_version_num')");
 });
 it('keeps canonical failure even when observer throws or rejects',async()=>{
  for(const observer of [()=>{throw Error('private');},()=>Promise.reject(Error('private'))])expect(reporter(observer)()).toEqual({status:'SCHEMA_NOT_READY'});
  await Promise.resolve();
 });
 it.each(Object.keys(counts).filter(k=>k!=='server_version_num'))('preserves independent rejection of damaged %s',key=>{
  for(const major of [16,18] as const)expect(runGate({...counts,server_version_num:major*10000,[key]:999},digests[major].attachments)).toEqual({status:'SCHEMA_NOT_READY'});
 });
});
