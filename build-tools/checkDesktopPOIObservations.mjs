// Browser plugin not available. Real Electron renderers, preload, IndexedDB and signed originals.
import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const web=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{desktop:{type:'string',default:path.resolve(web,'../ChargyDesktopApp')},'output-dir':{type:'string',default:path.join(os.tmpdir(),'chargy-desktop-observations-'+Date.now())}}});
const root=path.resolve(values.desktop),output=path.resolve(values['output-dir']);await mkdir(output,{recursive:true});
const fixture=name=>readFile(path.join(root,'tests/fixtures/POIObservedVersions',name),'utf8');
const vectors=JSON.parse(await fixture('vectors.json'));
const wrapper=path.join(output,'electron-qa.cjs');
await writeFile(wrapper,`const {app}=require('electron');
app.setPath('userData',${JSON.stringify(path.join(output,'profile-'+Date.now()))});
app.setAppPath(${JSON.stringify(root)});
app.commandLine.appendSwitch('lang','en-US');
app.on('browser-window-created',(_event,window)=>{window.webContents.setBackgroundThrottling(false);window.on('show',()=>{if(!window.__qaCapture)window.hide();});});
process.argv=[process.execPath,'.','--lang=en'];
require(${JSON.stringify(path.join(root,'src/main.cjs'))});
`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let electron;const errors=[],checks=[];
try{
    electron=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[wrapper],cwd:root,env,timeout:60000});
    await electron.context().route('**/*',route=>{
        const url=new URL(route.request().url());if(url.protocol==='file:')return route.continue();
        if(url.origin==='https://chargy.charging.cloud')return route.fulfill({json:{versions:[]}});
        // Map tiles are presentation assets, not POI evidence. Keep QA independent of that service.
        if(route.request().resourceType()==='image')return route.fulfill({body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'),contentType:'image/png'});
        errors.push('Unexpected external request '+url.origin+url.pathname);return route.abort();
    });
    await electron.firstWindow();let page;
    for(let attempt=0;attempt<100;attempt++){page=electron.windows().find(tab=>tab.url().startsWith('file:')&&tab.url().endsWith('/src/index.html'));if(page)break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(page,'Actual app renderer missing');
    await electron.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.webContents.closeDevTools();});
    const observe=tab=>{tab.setDefaultTimeout(30000);tab.on('pageerror',e=>errors.push(e.message));tab.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};observe(page);
    await page.waitForLoadState('domcontentloaded');await page.locator('#languageButton').click({force:true});await page.locator('#languageMenu [data-language=en]').click({force:true});
    await page.clock.setFixedTime(new Date(vectors.evaluatedAt));assert.match(await page.title(),/Chargy/);
    const mainWindowId=await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>win.webContents.getURL().endsWith('/src/index.html')).id);
    async function drop(tab,text){await tab.evaluate(text=>{const dt=new DataTransfer();dt.items.add(new File([text],'observations.chargy',{type:'application/json'}));document.querySelector('#input').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));},text);await tab.locator('.sessionPOI').waitFor({state:'attached'});}
    await drop(page,await fixture('archive-1.chargy'));
    await page.getByRole('button',{name:'Inspect supplied TrustAnchor …',exact:true}).click({force:true});
    const dialog=page.locator('#qrCodeScanner'),preview=dialog.locator('#qrCodeScannerTrustAnchorPreview');
    await dialog.getByRole('button',{name:'Import',exact:true}).click({force:true});await preview.locator('.trustAnchorLoadedData').waitFor({state:'attached'});
    for(const row of await preview.locator('.anchorKeyTrustKey').all()){
        await row.locator('[data-action=accept-key]').click({force:true});await row.locator('[data-action=confirm-key]').click({force:true});await row.locator('[data-key-trust=manual]').waitFor({state:'attached'});
    }
    await dialog.getByRole('button',{name:'Close',exact:true}).click({force:true});await page.locator('.sessionPriceResult[data-state=valid]').waitFor({state:'attached'});
    checks.push('Actual Electron app imports original evidence and obtains a valid price under explicit holder decisions');
    // A second renderer uses the same real preload and profile. No IPC permission is widened.
    const peerReady=electron.waitForEvent('window');
    await electron.evaluate(async({BrowserWindow},{root})=>{const peer=new BrowserWindow({show:false,width:1440,height:1050,webPreferences:{preload:root+'/src/preload.cjs',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});await peer.loadFile(root+'/src/index.html');},{root});
    const peer=await peerReady;observe(peer);await peer.waitForLoadState('domcontentloaded');await peer.clock.setFixedTime(new Date(vectors.evaluatedAt));
    await peer.locator('#languageButton').click({force:true});await peer.locator('#languageMenu [data-language=en]').click({force:true});
    await drop(peer,await fixture('checkpoint-fork-1.chargy'));
    await peer.locator('.sessionPriceResult .poiConsistency[data-state=invalid]').waitFor({state:'attached'});
    await page.locator('.poiObservedChangeNotice').waitFor({state:'attached'});
    await page.locator('.sessionPriceResult .poiConsistency[data-state=invalid]').waitFor({state:'attached'});
    await page.locator('.historicalSessionResult .poiConsistency[data-state=invalid]').waitFor({state:'attached'});
    assert.equal(await page.locator('.sessionPriceResult[data-state=valid],.historicalSessionResult[data-state=valid]').count(),0);
    assert.equal(await page.locator('.measurementValue .fa-check-circle').count(),2);
    checks.push('Genuine signed checkpoint fork in another Electron renderer invalidates and rechecks the already displayed original');
    checks.push('Independent original meter signatures remain visible; they do not restore POI consistency');
    await page.locator('.poiObservedChangeNotice').evaluate(element=>element.scrollIntoView({block:'start'}));
    const png=await electron.evaluate(async({BrowserWindow},id)=>{const win=BrowserWindow.fromId(id);win.__qaCapture=true;win.showInactive();try{await new Promise(resolve=>setTimeout(resolve,200));return(await win.webContents.capturePage(undefined,{stayAwake:true})).toPNG().toString('base64');}finally{win.hide();win.__qaCapture=false;}},mainWindowId);
    await writeFile(path.join(output,'desktop-cross-window-fork.png'),Buffer.from(png,'base64'));
    await page.reload({waitUntil:'domcontentloaded'});await page.clock.setFixedTime(new Date(vectors.evaluatedAt));await drop(page,await fixture('archive-1.chargy'));
    await page.locator('.sessionPriceResult .poiConsistency[data-state=invalid]').waitFor({state:'attached'});
    checks.push('Reload retains the negative journal and cannot revive the old green result');
    assert.deepEqual(errors,[]);
    await writeFile(path.join(output,'result.json'),JSON.stringify({success:true,url:page.url(),checks,errors},null,2));
    console.log(JSON.stringify({success:true,checks,output},null,2));
}catch(error){await writeFile(path.join(output,'result.json'),JSON.stringify({success:false,checks,errors,error:String(error.stack??error)},null,2));throw error;}
finally{await electron?.close();}
