import test from 'node:test';
import assert from 'node:assert/strict';
function workingDays(start,end){let n=0,d=new Date(`${start}T00:00:00Z`),e=new Date(`${end}T00:00:00Z`);while(d<=e){if(![0,6].includes(d.getUTCDay()))n++;d.setUTCDate(d.getUTCDate()+1)}return n}
test('counts weekdays only',()=>assert.equal(workingDays('2026-08-10','2026-08-14'),5));
test('weekend is zero working days',()=>assert.equal(workingDays('2026-08-15','2026-08-16'),0));
test('annual leave cap is 21 working days',()=>assert.ok(workingDays('2026-01-01','2026-01-29')>21));
