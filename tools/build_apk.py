#!/usr/bin/env python3
"""Build the small offline Android host without downloading any SDK components.

This intentionally narrow assembler emits only the five Activity methods described
in android/app/src/main/java/.../MainActivity.java. It is NOT a Java compiler.
APK, binary XML, resource table and DEX follow the public AOSP specifications.
A standard Android SDK build script is also supplied for native development.

Requirements: Python 3.10+, cryptography, Pillow. Never use a local TEST key
for production releases. No Internet permission or native libraries are included.
"""
from __future__ import annotations
from pathlib import Path
import struct as st, hashlib, zlib, zipfile, io, datetime, json
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.x509.oid import NameOID
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build';OUT.mkdir(exist_ok=True)
U32=lambda n:st.pack('<I',n&0xffffffff)
U16=lambda n:st.pack('<H',n&0xffff)
U64=lambda n:st.pack('<Q',n)
LP=lambda b:U32(len(b))+b
NONE=0xffffffff

def uleb(n:int)->bytes:
    b=bytearray()
    while True:
        v=n&127;n>>=7;b.append(v|(128 if n else 0))
        if not n:return bytes(b)

def chunk(kind:int, header:int, body:bytes)->bytes:
    return st.pack('<HHI',kind,header,8+len(body))+body

def string_pool(strings:list[str])->bytes:
    # UTF-16 string pool, including both the length and trailing terminator.
    data=bytearray();offsets=[]
    for s in strings:
        raw=s.encode('utf-16le');n=len(raw)//2
        if n>=32768:raise ValueError('Resource string too large')
        offsets.append(len(data));data+=U16(n)+raw+b'\0\0'
    data+=b'\0'*((-len(data))%4)
    return chunk(1,28,st.pack('<5I',len(strings),0,0,28+4*len(strings),0)+b''.join(U32(n) for n in offsets)+data)

# Stable public android.R.attr identifiers. No custom attribute IDs.
ATTR={'theme':0x01010000,'label':0x01010001,'icon':0x01010002,'name':0x01010003,
      'debuggable':0x0101000f,'exported':0x01010010,'configChanges':0x0101001f,
      'minSdkVersion':0x0101020c,'versionCode':0x0101021b,'versionName':0x0101021c,
      'targetSdkVersion':0x01010270,'allowBackup':0x01010280,'hardwareAccelerated':0x010102d3}

def manifest()->bytes:
    names=sorted(ATTR,key=ATTR.get)
    extra=['android','http://schemas.android.com/apk/res/android','manifest','package',
           'de.gleisgasse.prototyp','0.2.0','uses-sdk','application','Gleis & Gasse',
           'activity','de.gleisgasse.prototyp.MainActivity','intent-filter','action',
           'android.intent.action.MAIN','category','android.intent.category.LAUNCHER']
    strings=names+[s for s in extra if s not in names];sid={s:i for i,s in enumerate(strings)}
    ns=sid['http://schemas.android.com/apk/res/android']
    content=string_pool(strings)+chunk(0x180,8,b''.join(U32(ATTR[n]) for n in names))
    def node(t,payload):return chunk(t,16,U32(1)+U32(NONE)+payload)
    def start(name,attrs=()):
        aa=[]
        for key,typ,value in sorted(attrs,key=lambda a:ATTR.get(a[0],0)):
            namespace=ns if key in ATTR else NONE
            raw=sid[value] if typ==3 else NONE
            data=sid[value] if typ==3 else value
            aa.append(st.pack('<IIIHBBI',namespace,sid[key],raw,8,0,typ,data))
        ext=st.pack('<IIHHHHHH',NONE,sid[name],20,20,len(aa),0,0,0)
        return node(0x102,ext+b''.join(aa))
    def end(name):return node(0x103,st.pack('<II',NONE,sid[name]))
    content+=node(0x100,st.pack('<II',sid['android'],ns))
    content+=start('manifest',[('package',3,'de.gleisgasse.prototyp'),('versionCode',16,2),('versionName',3,'0.2.0')])
    content+=start('uses-sdk',[('minSdkVersion',16,30),('targetSdkVersion',16,37)])+end('uses-sdk')
    content+=start('application',[('theme',1,0x01030241),('label',3,'Gleis & Gasse'),('icon',1,0x7f010000),('allowBackup',18,0),('debuggable',18,0),('hardwareAccelerated',18,0xffffffff)])
    content+=start('activity',[('name',3,'de.gleisgasse.prototyp.MainActivity'),('exported',18,0xffffffff),('configChanges',17,0x4a0)])
    content+=start('intent-filter')+start('action',[('name',3,'android.intent.action.MAIN')])+end('action')
    content+=start('category',[('name',3,'android.intent.category.LAUNCHER')])+end('category')+end('intent-filter')
    content+=end('activity')+end('application')+end('manifest')
    content+=node(0x101,st.pack('<II',sid['android'],ns))
    return chunk(3,8,content)

def resources()->bytes:
    global_pool=string_pool(['res/drawable/ic_launcher.png'])
    types=string_pool(['drawable']);keys=string_pool(['ic_launcher'])
    # One public drawable entry; standard/default ResTable_config (64 bytes).
    spec=chunk(0x202,16,st.pack('<BBHI',1,0,0,1)+U32(0x40000000))
    config=U32(64)+b'\0'*60
    entry=st.pack('<HHI',8,2,0)+st.pack('<HBBI',8,0,3,0)
    type_chunk=chunk(0x201,84,st.pack('<BBHII',1,0,0,1,88)+config+U32(0)+entry)
    name='de.gleisgasse.prototyp'.encode('utf-16le').ljust(256,b'\0')
    package_body=U32(0x7f)+name+st.pack('<5I',288,1,288+len(types),1,0)+types+keys+spec+type_chunk
    package=chunk(0x200,288,package_body)
    return chunk(2,12,U32(1)+global_pool+package)

def icon()->bytes:
    s=192;im=Image.new('RGBA',(s,s),(232,239,221,255));d=ImageDraw.Draw(im)
    d.rounded_rectangle((20,20,172,172),radius=44,fill='#2f7060')
    white='#faf9ea';d.rounded_rectangle((58,55,134,139),radius=16,outline=white,width=7)
    d.line((73,39,119,39),fill=white,width=7);d.line((96,39,96,54),fill=white,width=6)
    d.line((60,101,132,101),fill=white,width=6);d.line((96,58,96,99),fill=white,width=6)
    for x in (75,115):d.ellipse((x-5,115,x+5,125),fill=white)
    d.line((81,140,69,155),fill=white,width=6);d.line((111,140,123,155),fill=white,width=6)
    out=io.BytesIO();im.save(out,format='PNG');return out.getvalue()


ACT='Landroid/app/Activity;';MAIN='Lde/gleisgasse/prototyp/MainActivity;'
WV='Landroid/webkit/WebView;';WS='Landroid/webkit/WebSettings;';WVC='Landroid/webkit/WebViewClient;'
CTX='Landroid/content/Context;';ASSET='Landroid/content/res/AssetManager;';BUNDLE='Landroid/os/Bundle;'
VIEW='Landroid/view/View;';WIN='Landroid/view/Window;';STRING='Ljava/lang/String;';INPUT='Ljava/io/InputStream;'
SCANNER='Ljava/util/Scanner;';CALLBACK='Landroid/webkit/ValueCallback;'
FRAME='Landroid/widget/FrameLayout;';LISTENER='Landroid/view/View$OnApplyWindowInsetsListener;'
WI='Landroid/view/WindowInsets;';WTYPE='Landroid/view/WindowInsets$Type;';INSETS='Landroid/graphics/Insets;'
METHODS=[]
def method(cls,name,ret='V',args=()):
    m=(cls,name,ret,tuple(args))
    if m not in METHODS:METHODS.append(m)
    return m
M={}
for cls,name,ret,args in [
 (ACT,'<init>','V',()),(ACT,'onCreate','V',(BUNDLE,)),(ACT,'onPause','V',()),(ACT,'onResume','V',()),
 (ACT,'getAssets',ASSET,()),(ACT,'setContentView','V',(VIEW,)),(ACT,'getWindow',WIN,()),
 (WV,'<init>','V',(CTX,)),(WV,'getSettings',WS,()),(WV,'setWebViewClient','V',(WVC,)),
 (WV,'setBackgroundColor','V',('I',)),(WV,'loadDataWithBaseURL','V',(STRING,)*5),
 (WV,'evaluateJavascript','V',(STRING,CALLBACK)),(WV,'onPause','V',()),(WV,'onResume','V',()),
 (WVC,'<init>','V',()),(ASSET,'open',INPUT,(STRING,)),(SCANNER,'<init>','V',(INPUT,STRING)),
 (SCANNER,'useDelimiter',SCANNER,(STRING,)),(SCANNER,'next',STRING,()),(SCANNER,'close','V',()),
 (WIN,'setNavigationBarColor','V',('I',)),(WIN,'getDecorView',VIEW,()),(VIEW,'setSystemUiVisibility','V',('I',)),
 (WIN,'setDecorFitsSystemWindows','V',('Z',)),
 (FRAME,'<init>','V',(CTX,)),(FRAME,'addView','V',(VIEW,'I','I')),
 (VIEW,'setBackgroundColor','V',('I',)),(VIEW,'setOnApplyWindowInsetsListener','V',(LISTENER,)),
 (VIEW,'requestApplyInsets','V',()),(VIEW,'setPadding','V',('I','I','I','I')),
 (WI,'getInsets',INSETS,('I',)),(WTYPE,'systemBars','I',()),(WTYPE,'displayCutout','I',()),(WTYPE,'ime','I',()),
 (WS,'setJavaScriptEnabled','V',('Z',)),(WS,'setDomStorageEnabled','V',('Z',)),
 (WS,'setAllowFileAccess','V',('Z',)),(WS,'setAllowContentAccess','V',('Z',)),
 (WS,'setAllowFileAccessFromFileURLs','V',('Z',)),(WS,'setAllowUniversalAccessFromFileURLs','V',('Z',)),
 (WS,'setJavaScriptCanOpenWindowsAutomatically','V',('Z',)),(WS,'setSupportMultipleWindows','V',('Z',)),
 (WS,'setGeolocationEnabled','V',('Z',)),(WS,'setBlockNetworkLoads','V',('Z',)),(WS,'setBlockNetworkImage','V',('Z',)),
 (WS,'setMixedContentMode','V',('I',)),
 (MAIN,'<init>','V',()),(MAIN,'onCreate','V',(BUNDLE,)),(MAIN,'onPause','V',()),(MAIN,'onResume','V',()),
 (MAIN,'onApplyWindowInsets',WI,(VIEW,WI))]:
    M[(cls,name)]=method(cls,name,ret,args)
CONSTANTS=['index.html','UTF-8','\\A','https://appassets.androidplatform.net/','text/html',
           'if(window.GG)window.GG.suspend();','if(window.GG)window.GG.resume();','MainActivity.java']
FIELDS=[(MAIN,'web',WV),(WI,'CONSUMED',WI),*[(INSETS,n,'I') for n in ['left','top','right','bottom']]]

def dex()->bytes:
    types=set([MAIN,ACT,WV,LISTENER]);protos=set()
    for cls,name,ret,args in METHODS:types.update([cls,ret,*args]);protos.add((ret,args))
    for cls,name,t in FIELDS:types.update([cls,t])
    def short(t):return t if len(t)==1 else 'L'
    strings=set(CONSTANTS)|types|{m[1] for m in METHODS}|{f[1] for f in FIELDS}|{short(r)+''.join(short(t) for t in a) for r,a in protos}
    strings=sorted(strings);si={s:i for i,s in enumerate(strings)}
    types=sorted(types,key=si.get);ti={s:i for i,s in enumerate(types)}
    protos=sorted(protos,key=lambda p:(ti[p[0]],tuple(ti[t] for t in p[1])));pi={p:i for i,p in enumerate(protos)}
    methods=sorted(METHODS,key=lambda m:(ti[m[0]],si[m[1]],pi[(m[2],m[3])]))
    fields=sorted(FIELDS,key=lambda f:(ti[f[0]],si[f[1]],ti[f[2]]));fi={f:i for i,f in enumerate(fields)}
    mi={m:i for i,m in enumerate(methods)};ownfield=fi[(MAIN,'web',WV)]
    ns,nt,np,nm,nf=len(strings),len(types),len(protos),len(methods),len(fields)
    so=112;to=so+ns*4;po=to+nt*4;fo=po+np*12;mo=fo+nf*8;co=mo+nm*8;data_off=co+32
    buf=bytearray(data_off);map_items=[(0,1,0),(1,ns,so),(2,nt,to),(3,np,po),(4,nf,fo),(5,nm,mo),(6,1,co)]
    def align():buf.extend(b'\0'*((-len(buf))%4))
    str_offsets=[]
    for s in strings:
        str_offsets.append(len(buf));buf.extend(uleb(len(s))+s.encode('utf-8')+b'\0')
    map_items.append((0x2002,len(strings),str_offsets[0]))
    param_offsets={};param_start=None
    # This includes the one-element interface list; it can share a type_list.
    for args in [p[1] for p in protos]+[(LISTENER,)]:
        if not args or args in param_offsets:continue
        align();param_offsets[args]=len(buf)
        if param_start is None:param_start=len(buf)
        buf.extend(U32(len(args))+b''.join(U16(ti[t]) for t in args))
    if param_offsets:map_items.append((0x1001,len(param_offsets),param_start))
    def invoke(cls,name,regs,kind=0x6e):
        assert len(regs)<=5 and all(0<=r<16 for r in regs)
        r=regs+[0]*(5-len(regs))
        return [kind|(len(regs)<<12)|(r[4]<<8),mi[M[(cls,name)]],r[0]|r[1]<<4|r[2]<<8|r[3]<<12]
    def const4(reg,val):assert 0<=reg<16 and -8<=val<=7;return [0x12|reg<<8|(val&15)<<12]
    def const32(reg,val):return [0x14|reg<<8,val&65535,(val>>16)&65535]
    def text(reg,s):return [0x1a|reg<<8,si[s]]
    def result(reg,obj=True):return [(0x0c if obj else 0x0a)|reg<<8]
    def new(reg,t):return [0x22|reg<<8,ti[t]]
    def code(regs,ins,outs,words):return st.pack('<HHHHII',regs,ins,outs,0,0,len(words))+st.pack('<'+'H'*len(words),*words)
    funcs={}
    funcs['<init>']=(1,1,1,invoke(ACT,'<init>',[0],0x70)+[0x0e])
    c=invoke(ACT,'onCreate',[10,11],0x6f)+new(0,WV)+invoke(WV,'<init>',[0,10],0x70)
    c+=[0x5b|(10<<12),ownfield]  # iput-object v0, v10, own web
    c+=invoke(WV,'getSettings',[0])+result(1)+const4(2,1)
    for name in ['setJavaScriptEnabled','setDomStorageEnabled','setBlockNetworkLoads','setBlockNetworkImage']:c+=invoke(WS,name,[1,2])
    c+=const4(2,0)
    for name in ['setAllowFileAccess','setAllowContentAccess','setAllowFileAccessFromFileURLs','setAllowUniversalAccessFromFileURLs','setJavaScriptCanOpenWindowsAutomatically','setSupportMultipleWindows','setGeolocationEnabled']:c+=invoke(WS,name,[1,2])
    c+=const4(2,1)+invoke(WS,'setMixedContentMode',[1,2])
    c+=const32(2,0xffe4ebda)+invoke(WV,'setBackgroundColor',[0,2])
    c+=new(1,WVC)+invoke(WVC,'<init>',[1],0x70)+invoke(WV,'setWebViewClient',[0,1])
    # The root receives modern system-bar, cutout and IME insets. The WebView is
    # inset by root padding, so no game control sits underneath the gesture bar.
    c+=new(7,FRAME)+invoke(FRAME,'<init>',[7,10],0x70)+const32(2,0xfff8f6ed)+invoke(VIEW,'setBackgroundColor',[7,2])
    c+=const4(2,-1)+invoke(FRAME,'addView',[7,0,2,2])+invoke(VIEW,'setOnApplyWindowInsetsListener',[7,10])
    c+=invoke(ACT,'getWindow',[10])+result(1)+const4(2,0)+invoke(WIN,'setDecorFitsSystemWindows',[1,2])
    c+=invoke(ACT,'setContentView',[10,7])+invoke(VIEW,'requestApplyInsets',[7])
    c+=invoke(ACT,'getAssets',[10])+result(1)+text(2,'index.html')+invoke(ASSET,'open',[1,2])+result(1)
    c+=new(6,SCANNER)+text(2,'UTF-8')+invoke(SCANNER,'<init>',[6,1,2],0x70)
    c+=text(2,'\\A')+invoke(SCANNER,'useDelimiter',[6,2])+invoke(SCANNER,'next',[6])+result(2)+invoke(SCANNER,'close',[6])
    c+=text(1,'https://appassets.androidplatform.net/')+text(3,'text/html')+const4(4,0)
    c+=[0x07|(5<<8)|(1<<12)]  # move-object v5, v1
    c+=[0x74|(6<<8),mi[M[(WV,'loadDataWithBaseURL')]],0]
    c+=invoke(ACT,'getWindow',[10])+result(1)+const32(2,0xfff8f6ed)+invoke(WIN,'setNavigationBarColor',[1,2])
    c+=invoke(WIN,'getDecorView',[1])+result(1)+[0x13|(2<<8),8208]+invoke(VIEW,'setSystemUiVisibility',[1,2])+[0x0e]
    funcs['onCreate']=(12,2,6,c)
    for name,action in [('onPause','suspend'),('onResume','resume')]:
        c=invoke(ACT,name,[3],0x6f)+[0x54|(3<<12),ownfield]
        branch=len(c);c += [0x38,0]
        if name=='onResume':c+=invoke(WV,name,[0])
        c+=text(1,f'if(window.GG)window.GG.{action}();')+const4(2,0)+invoke(WV,'evaluateJavascript',[0,1,2])
        if name=='onPause':c+=invoke(WV,name,[0])
        c[branch+1]=len(c)-branch;c+=[0x0e]
        funcs[name]=(4,1,3,c)
    # onApplyWindowInsets has p0=this(v6), p1=view(v7), p2=insets(v8).
    c=invoke(WTYPE,'systemBars',[],0x71)+result(0,False)
    for name in ['displayCutout','ime']:
        c+=invoke(WTYPE,name,[],0x71)+result(1,False)+[0x0096,0x0100] # or-int v0,v0,v1
    c+=invoke(WI,'getInsets',[8,0])+result(0)
    for reg,name in [(1,'left'),(2,'top'),(3,'right'),(4,'bottom')]:c += [0x52|(reg<<8),fi[(INSETS,name,'I')]]
    c+=invoke(VIEW,'setPadding',[7,1,2,3,4])+[0x62,fi[(WI,'CONSUMED',WI)]]+[0x11]
    funcs['onApplyWindowInsets']=(9,3,5,c)
    code_offsets={};code_start=None
    names=['<init>','onCreate','onPause','onResume','onApplyWindowInsets']
    for name in names:
        align();code_offsets[name]=len(buf)
        if code_start is None:code_start=len(buf)
        buf.extend(code(*funcs[name]))
    map_items.append((0x2001,len(names),code_start))
    class_data_off=len(buf)
    buf.extend(uleb(0)+uleb(1)+uleb(1)+uleb(4))
    buf.extend(uleb(ownfield)+uleb(2))
    buf.extend(uleb(mi[M[(MAIN,'<init>')]])+uleb(0x10001)+uleb(code_offsets['<init>']))
    prev=0
    for name in sorted(names[1:],key=lambda n:mi[M[(MAIN,n)]]):
        index=mi[M[(MAIN,name)]];flags=1 if name=='onApplyWindowInsets' else 4
        buf.extend(uleb(index-prev)+uleb(flags)+uleb(code_offsets[name]));prev=index
    map_items.append((0x2000,1,class_data_off))
    align();map_off=len(buf);map_items.append((0x1000,1,map_off));map_items.sort(key=lambda m:m[2])
    buf.extend(U32(len(map_items))+b''.join(st.pack('<HHII',t,0,n,o) for t,n,o in map_items))
    for i,o in enumerate(str_offsets):st.pack_into('<I',buf,so+i*4,o)
    for i,t in enumerate(types):st.pack_into('<I',buf,to+i*4,si[t])
    for i,(ret,args) in enumerate(protos):st.pack_into('<III',buf,po+i*12,si[short(ret)+''.join(short(t) for t in args)],ti[ret],param_offsets.get(args,0))
    for i,(cls,name,t) in enumerate(fields):st.pack_into('<HHI',buf,fo+i*8,ti[cls],ti[t],si[name])
    for i,(cls,name,ret,args) in enumerate(methods):st.pack_into('<HHI',buf,mo+i*8,ti[cls],pi[(ret,args)],si[name])
    st.pack_into('<8I',buf,co,ti[MAIN],0x11,ti[ACT],param_offsets[(LISTENER,)],si['MainActivity.java'],0,class_data_off,0)
    st.pack_into('<8sI20s20I',buf,0,b'dex\n035\0',0,b'\0'*20,len(buf),112,0x12345678,0,0,map_off,ns,so,nt,to,np,po,nf,fo,nm,mo,1,co,len(buf)-data_off,data_off)
    buf[12:32]=hashlib.sha1(buf[32:]).digest();st.pack_into('<I',buf,8,zlib.adler32(buf[12:])&0xffffffff)
    (OUT/'dex-map.json').write_text(json.dumps({'strings':strings,'types':types,'fields':fields,'methods':[(m[0],m[1],m[2],m[3]) for m in methods], 'code':{n:{'offset':code_offsets[n],'registers':v[0],'ins':v[1],'outs':v[2],'words':v[3]} for n,v in funcs.items()}},indent=2))
    return bytes(buf)

def signing_material():
    key_path=ROOT/'tools/TEST-ONLY-key.pem';cert_path=ROOT/'tools/TEST-ONLY-cert.pem'
    if key_path.exists():
        key=serialization.load_pem_private_key(key_path.read_bytes(),password=None)
        cert=x509.load_pem_x509_certificate(cert_path.read_bytes())
    else:
        key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Gleis und Gasse Prototype Test Key'),x509.NameAttribute(NameOID.ORGANIZATION_NAME,'Local prototype - NOT FOR PRODUCTION')])
        cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(datetime.datetime(2026,1,1,tzinfo=datetime.timezone.utc)).not_valid_after(datetime.datetime(2051,1,1,tzinfo=datetime.timezone.utc)).sign(key,hashes.SHA256()))
        key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
        key_path.chmod(0o600);cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return key,cert

def content_digest(sections):
    chunks=[]
    for section in sections:
        for i in range(0,len(section),1024*1024):
            c=section[i:i+1024*1024];chunks.append(hashlib.sha256(b'\xa5'+U32(len(c))+c).digest())
    return hashlib.sha256(b'\x5a'+U32(len(chunks))+b''.join(chunks)).digest()

def sign_apk(unsigned:bytes)->bytes:
    key,cert=signing_material();eocd=unsigned.rfind(b'PK\x05\x06');cd=st.unpack_from('<I',unsigned,eocd+16)[0]
    assert eocd>=0 and eocd+22==len(unsigned)
    digest=content_digest([unsigned[:cd],unsigned[cd:eocd],unsigned[eocd:]])
    alg=0x0103
    signed_data=LP(LP(U32(alg)+LP(digest)))+LP(LP(cert.public_bytes(serialization.Encoding.DER)))+LP(b'')
    sig=key.sign(signed_data,padding.PKCS1v15(),hashes.SHA256())
    public=key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
    signer=LP(signed_data)+LP(LP(U32(alg)+LP(sig)))+LP(public)
    value=LP(LP(signer));pair=U64(4+len(value))+U32(0x7109871a)+value
    block=U64(len(pair)+24)+pair+U64(len(pair)+24)+b'APK Sig Block 42'
    new_eocd=bytearray(unsigned[eocd:]);st.pack_into('<I',new_eocd,16,cd+len(block))
    return unsigned[:cd]+block+unsigned[cd:eocd]+new_eocd

def build():
    import subprocess,sys
    subprocess.run([sys.executable,str(ROOT/'tools/bundle.py')],check=True)
    files={'AndroidManifest.xml':manifest(),'resources.arsc':resources(),'classes.dex':dex(),
           'res/drawable/ic_launcher.png':icon(),'assets/index.html':(ROOT/'web/index.html').read_bytes()}
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        for name,data in files.items():
            info=zipfile.ZipInfo(name,(2026,10,17,12,0,0));info.compress_type=zipfile.ZIP_DEFLATED if name.startswith('assets/') else zipfile.ZIP_STORED
            if info.compress_type==zipfile.ZIP_STORED:
                pad=(- (out.tell()+30+len(name.encode())+4))%4
                info.extra=st.pack('<HH',0xd935,pad)+b'\0'*pad
            z.writestr(info,data)
    apk=sign_apk(out.getvalue());dest=OUT/'Gleis-und-Gasse-0.2.0.apk';dest.write_bytes(apk)
    (OUT/'AndroidManifest.xml.bin').write_bytes(files['AndroidManifest.xml']);(OUT/'classes.dex').write_bytes(files['classes.dex'])
    res=ROOT/'android/app/src/main/res/drawable';res.mkdir(parents=True,exist_ok=True);(res/'ic_launcher.png').write_bytes(files['res/drawable/ic_launcher.png'])
    print(f'APK: {dest} ({len(apk)} bytes)')
    print('SHA-256:',hashlib.sha256(apk).hexdigest())
if __name__=='__main__':build()
