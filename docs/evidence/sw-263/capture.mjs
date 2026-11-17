import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const mode = process.argv[2];
const out = new URL('.', import.meta.url).pathname;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#242522"/><path d="M0 0H400V45H0ZM0 355H400V400H0Z" fill="#e56936"/><path d="M0 0V400H20V0ZM380 0H400V400H380Z" fill="#a0d1b7"/><text x="200" y="32" text-anchor="middle" font-size="24" fill="white">TOP EDGE</text><text x="200" y="212" text-anchor="middle" font-size="40" fill="white">FULL ART</text><text x="200" y="386" text-anchor="middle" font-size="24" fill="white">BOTTOM EDGE</text></svg>`;
const art = 'data:image/svg+xml,'+encodeURIComponent(svg);
const profiles = [
{id:'square', name:'Square artwork', display:{image:art,accentColor:'#a0d1b7'}},
{id:'dark', name:'Dark accent', display:{image:art,accentColor:'#242522'}},
{id:'missing', name:'No artwork', display:{accentColor:'#ff6b20'}},
{id:'failed', name:'Failed artwork', display:{image:'missing.png',accentColor:'#7535ab'}},
{id:'default', name:'A very long profile name that must stay inside its card',display:{}},
{id:'portrait', name:'Portrait artwork',display:{image:'data:image/svg+xml,'+encodeURIComponent(svg.replace('width="400"','width="200" viewBox="0 0 400 400"')),accentColor:'#fff'}}
];
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-webgl']});
const page = await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
const requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.routeWebSocket('**/socket.io/**', ws=>{
ws.send('0'+JSON.stringify({sid:'fixture',upgrades:[],pingInterval:25000,pingTimeout:20000}));
ws.onMessage(msg=>{if(String(msg).startsWith('40')){ws.send('40'+JSON.stringify({sid:'fixture'}));ws.send('42'+JSON.stringify(['status',{state:'idle',name:'idle',id:'square',loaded_profile:'Square artwork',extracting:false,sensors:{w:0,t:25},setpoints:{temperature:90}}]));}});
});
await page.route('**/api/v1/**',async route=>{
const path=new URL(route.request().url()).pathname;
requests.push({method:route.request().method(),path});
if(path.includes('/profile/image/')) return route.fulfill({status:404,body:'not found'});
let data={};
if(path==='/api/v1/profile/list')data=profiles;
else if(path.includes('/settings'))data={profile_order:profiles.map(p=>p.id)};
else if(path==='/api/v1/machine')data={name:'Meticulous',color:'black'};
else if(path.includes('/history'))data=null;
await route.fulfill({json:data});
});
await page.goto(process.argv[3]);
await page.evaluate(()=>document.fonts.ready);
await page.locator('[data-profile-id="square"] img').waitFor();
await page.getByRole('button',{name:'Dark accent',exact:true}).click();
await page.getByText('On machine',{exact:true}).waitFor();
await page.locator('[data-profile-id="square"]').scrollIntoViewIfNeeded();
await page.mouse.move(10,10);
await page.locator('section[aria-labelledby="profiles-heading"]').screenshot({path:`${out}/${mode}-strip-desktop.png`,animations:'disabled'});
await page.screenshot({path:`${out}/${mode}-desktop.png`,animations:'disabled'});
if(mode==='after') {
const thumb=page.getByRole('button').filter({has:page.getByText('Not loaded yet',{exact:true})}).locator('img');
assert.equal(await thumb.evaluate(el=>getComputedStyle(el).objectFit),'cover');
for (const id of ['square','dark']) {
const box=await page.locator(`[data-profile-id="${id}"] img`).evaluate(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,fit:getComputedStyle(el).objectFit,transform:getComputedStyle(el).transform};});
assert.equal(box.w,box.h);assert.equal(box.fit,'contain');
await page.locator(`[data-profile-id="${id}"]`).hover();
assert.equal(await page.locator(`[data-profile-id="${id}"] img`).evaluate(el=>getComputedStyle(el).transform),'none');
}
assert.equal(await page.locator('[data-profile-id="failed"] img').count(),0);
assert.equal(await page.locator('[data-profile-id="missing"] img').count(),0);
for(const id of ['failed','missing']) assert.match(await page.locator(`[data-profile-id="${id}"] button > div`).first().evaluate(el=>getComputedStyle(el.firstElementChild).backgroundImage),/gradient/);
await page.getByRole('button',{name:'Square artwork options',exact:true}).click();
await page.getByRole('menuitem',{name:'Download JSON'}).waitFor();
const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('menuitem',{name:'Download JSON'}).click()]);
assert.equal(download.suggestedFilename(),'Square artwork.json');
const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),profiles[0]);
assert.equal(await page.locator('[data-profile-id="dark"] button[aria-pressed="true"]').count(),1);
assert.equal(requests.filter(r=>r.method!=='GET'||r.path.includes('/profile/load/')).length,0);
}
await page.getByRole('button',{name:/View all/}).click();
await page.getByRole('dialog').waitFor();
await page.mouse.move(10,10);
await page.screenshot({path:`${out}/${mode}-picker-desktop.png`,animations:'disabled'});
if(mode==='after') {
await page.getByPlaceholder('Search by name or author').fill('No artwork');
assert.equal(await page.getByRole('dialog').locator('[data-profile-id]').count(),1);
await page.getByPlaceholder('Search by name or author').fill('');
await page.getByRole('dialog').getByRole('button',{name:'No artwork',exact:true}).click();
await page.getByRole('dialog').waitFor({state:'hidden'});
await page.locator('[data-profile-id="missing"] button[aria-pressed="true"]').waitFor();
await page.getByRole('button',{name:/View all/}).click();
await page.getByRole('dialog').getByRole('button',{name:'Dark accent',exact:true}).click();
await page.getByRole('button',{name:/View all/}).click();
}
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:`${out}/${mode}-picker-mobile.png`,animations:'disabled'});
if(mode==='after') {
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
const cards=page.getByRole('dialog').locator('[data-profile-id]');
for(let i=0;i<await cards.count();i++){
const b=await cards.nth(i).boundingBox(); assert.ok(b.x>=0&&b.x+b.width<=390);
}
await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
await page.screenshot({path:`${out}/after-picker-mobile-dark.png`,animations:'disabled'});
}
if(mode==='after') {
for(const width of [320,768]) {
await page.setViewportSize({width,height:1000});
console.log('width-check',width,await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,cls:el.className,x:el.getBoundingClientRect().x,w:el.getBoundingClientRect().width})).filter(el=>el.x+el.w>innerWidth+1).slice(0,10)})));
const dialogBox=await page.getByRole('dialog').boundingBox(); assert.ok(dialogBox.x>=0&&dialogBox.x+dialogBox.width<=width);
for(const card of await page.getByRole('dialog').locator('[data-profile-id]').all()){const b=await card.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);}
}
await page.getByRole('dialog').getByRole('button',{name:'Dark accent options',exact:true}).focus();
await page.keyboard.press('Enter');
await page.getByRole('menuitem',{name:'Download JSON'}).waitFor();
await page.keyboard.press('Escape');
assert.equal(await page.getByRole('menu').count(),0);

}
if(mode==='before'){await page.setViewportSize({width:320,height:1000});console.log('baseline-320-width',await page.evaluate(()=>document.documentElement.scrollWidth));}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({result:'PASS',mode,requests,errors}));
await browser.close();
