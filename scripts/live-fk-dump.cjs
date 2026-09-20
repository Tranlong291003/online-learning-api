const fs=require("fs");const {Client}=require("pg");
const pw=decodeURIComponent(new URL(fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim()).password);
(async()=>{
const c=new Client({host:"aws-0-ap-northeast-1.pooler.supabase.com",port:5432,database:"postgres",
 user:"postgres.hgugynckgityoacmqpcj",password:pw,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
await c.connect();
const r=await c.query(`
select tc.table_name, kcu.column_name, ccu.table_name ref_table, ccu.column_name ref_col, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name
where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
order by tc.table_name`);
console.log("### FOREIGN KEYS");
r.rows.forEach(x=>console.log("  "+(x.table_name+"."+x.column_name).padEnd(34)+"-> "+x.ref_table+"."+x.ref_col+"  onDelete="+x.delete_rule));
await c.end();})().catch(e=>console.log("ERR:",e.message.split("\n")[0]));
