import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
const source=readFileSync(new URL('../src/client.ts',import.meta.url),'utf8');
const tree=ts.createSourceFile('client.ts',source,ts.ScriptTarget.Latest,true);
let helper='';let gate='';
function visit(node: ts.Node) {
 if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='schemaNotReady') helper=node.getText(tree);
 if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('knowledgeFoundation?.knowledge_table_count !== 4')&&node.expression.getText(tree).includes('knowledgeCatalogDigest !== expectedKnowledgeCatalogDigest')) gate=node.getText(tree);
 ts.forEachChild(node,visit);
}
visit(tree);
function reporter(observer?: (s:string)=>unknown) {
 expect(helper).not.toBe('');
 const code=ts.transpileModule(`const ${helper};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('options',`${code};return schemaNotReady;`)({onSchemaNotReady:observer});
}
const counts={knowledge_table_count:4,knowledge_owner_safe_count:4,knowledge_rls_count:4,knowledge_force_rls_count:4,knowledge_policy_count:4,knowledge_policy_total_count:4,knowledge_acl_count:0,knowledge_column_acl_count:0,knowledge_function_count:19,knowledge_function_acl_count:5,knowledge_function_acl_safe_count:5,knowledge_function_execute_count:5,knowledge_index_count:7,knowledge_pg_trgm_count:1,knowledge_trigger_count:3,knowledge_column_shape_count:10,server_version_num:180001};
function runGate(row: typeof counts, observe: (s:string)=>unknown, catalog='a'.repeat(64)) {
 expect(gate).not.toBe('');
 const code=ts.transpileModule(gate,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('knowledgeFoundation','knowledgeCatalogDigest','expectedKnowledgeCatalogDigest','knowledgeSourceDigest','expectedKnowledgeSourceDigest','expectedKnowledgeExecuteCount','knowledgeAttachmentsPhase','schemaNotReady',`${code};return {status:'READY'};`)(row,catalog,'a'.repeat(64),'b'.repeat(64),'b'.repeat(64),5,'EXPAND',reporter(observe));
}
describe('knowledge readiness finite diagnostics',()=>{
 it('emits only allowed diagnostic markers without changing the canonical result',()=>{
  const observe=vi.fn();
  expect(reporter(observe)(()=>['KNOWLEDGE_CATALOG_MISMATCH','PRIVATE_SENTINEL','KNOWLEDGE_PG_MAJOR_18','KNOWLEDGE_CATALOG_SHA256_'+ 'a'.repeat(64)])).toEqual({status:'SCHEMA_NOT_READY'});
  expect(observe.mock.calls.flat()).toContain('KNOWLEDGE_CATALOG_MISMATCH');
  expect(observe.mock.calls.flat()).toContain('KNOWLEDGE_PG_MAJOR_18');
  expect(JSON.stringify(observe.mock.calls)).not.toContain('PRIVATE_SENTINEL');
 });
 it('keeps schema failure on throwing/rejecting observers and throwing details',async()=>{
  for(const observer of [()=>{throw Error('private');},()=>Promise.reject(Error('private'))])expect(reporter(observer)(()=>['KNOWLEDGE_CATALOG_MISMATCH'])).toEqual({status:'SCHEMA_NOT_READY'});
  expect(reporter(vi.fn())(()=>{throw Error('private');})).toEqual({status:'SCHEMA_NOT_READY'});
  await Promise.resolve();
 });
 it('exercises the real gate, distinguishing catalog drift and actual server major',()=>{
  const observe=vi.fn();
  expect(runGate(counts,observe)).toEqual({status:'READY'});expect(observe).not.toHaveBeenCalled();
  expect(runGate({...counts,server_version_num:170005},observe,'c'.repeat(64))).toEqual({status:'SCHEMA_NOT_READY'});
  expect(observe.mock.calls.flat()).toContain('KNOWLEDGE_CATALOG_MISMATCH');
  expect(observe.mock.calls.flat()).toContain('KNOWLEDGE_CATALOG_SHA256_'+ 'c'.repeat(64));
  expect(observe.mock.calls.flat()).toContain('KNOWLEDGE_PG_MAJOR_17');
  expect(observe.mock.calls.flat()).not.toContain('KNOWLEDGE_SOURCE_MISMATCH');
 });
 it.each(Object.keys(counts).filter(k=>k!=='server_version_num'))('preserves rejection of damaged %s',key=>{
  const observe=vi.fn();
  const damaged={...counts,[key]:999};
  expect(runGate(damaged,observe)).toEqual({status:'SCHEMA_NOT_READY'});
  expect(observe.mock.calls.flat().some(x=>/^KNOWLEDGE_.*_MISMATCH$/.test(x))).toBe(true);
 });
});
