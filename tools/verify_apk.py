#!/usr/bin/env python3
"""Independent structural/integrity checks; does not substitute an Android runtime test."""
from pathlib import Path
import struct,hashlib,zlib,zipfile,io,json,sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding
ROOT=Path(__file__).resolve().parents[1]
file=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'build/Gleis-und-Gasse-0.2.0.apk'
b=file.read_bytes(); checks=[]
def passed(s):checks.append(s);print('PASS',s)
def u32(buf,p=0):return struct.unpack_from('<I',buf,p)[0]
def u16(buf,p=0):return struct.unpack_from('<H',buf,p)[0]
def u64(buf,p=0):return struct.unpack_from('<Q',buf,p)[0]
def lp(buf,p=0):n=u32(buf,p);assert p+4+n<=len(buf);return buf[p+4:p+4+n],p+4+n
# Verify whole-file APK v2 signature, not merely ZIP checksums.
eocd=b.rfind(b'PK\x05\x06');assert eocd+22==len(b)
cd=u32(b,eocd+16);assert cd+u32(b,eocd+12)==eocd
assert b[cd-16:cd]==b'APK Sig Block 42'
size=u64(b,cd-24);sign_start=cd-size-8;assert u64(b,sign_start)==size
pos=sign_start+8;v2=None
while pos<cd-24:
    length=u64(b,pos);ident=u32(b,pos+8);value=b[pos+12:pos+8+length];pos+=8+length
    if ident==0x7109871a:v2=value
assert v2 is not None and pos==cd-24
signers,_=lp(v2);signer,end=lp(signers);assert end==len(signers)
signed,pos=lp(signer);sigs,pos=lp(signer,pos);pub,pos=lp(signer,pos);assert pos==len(signer)
sig,_=lp(sigs);assert u32(sig)==0x0103
sig_bytes,end=lp(sig,4);assert end==len(sig)
pubkey=serialization.load_der_public_key(pub)
pubkey.verify(sig_bytes,signed,padding.PKCS1v15(),hashes.SHA256())
digests,pos=lp(signed);certs,pos=lp(signed,pos);attrs,pos=lp(signed,pos);assert pos==len(signed)
digest_record,_=lp(digests);assert u32(digest_record)==0x0103;digest,_=lp(digest_record,4)
cert_der,_=lp(certs);cert=x509.load_der_x509_certificate(cert_der)
assert cert.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)==pub
modified_eocd=bytearray(b[eocd:]);struct.pack_into('<I',modified_eocd,16,sign_start)
leaves=[]
for section in [b[:sign_start],b[cd:eocd],bytes(modified_eocd)]:
    for offset in range(0,len(section),1048576):
        c=section[offset:offset+1048576];leaves.append(hashlib.sha256(b'\xa5'+struct.pack('<I',len(c))+c).digest())
actual=hashlib.sha256(b'\x5a'+struct.pack('<I',len(leaves))+b''.join(leaves)).digest()
assert actual==digest
passed('APK v2 signature, certificate/public-key match and whole-file SHA-256 chunk digest')
with zipfile.ZipFile(io.BytesIO(b)) as z:
    assert z.testzip() is None
    names=z.namelist();assert len(names)==len(set(names))
    assert {'AndroidManifest.xml','resources.arsc','classes.dex','assets/index.html','res/drawable/ic_launcher.png'}==set(names)
    passed('ZIP integrity, required files, no native libraries or additional hidden files')
    for info in z.infolist():
        if info.compress_type==zipfile.ZIP_STORED:
            offset=info.header_offset+30+u16(b,info.header_offset+26)+u16(b,info.header_offset+28)
            assert offset%4==0,(info.filename,offset)
    assert z.getinfo('resources.arsc').compress_type==zipfile.ZIP_STORED
    passed('Uncompressed resource table and 4-byte alignment of stored ZIP entries')
    axml=z.read('AndroidManifest.xml');dex=z.read('classes.dex');arsc=z.read('resources.arsc');html=z.read('assets/index.html')
assert html==(ROOT/'web/index.html').read_bytes()
passed('APK contains byte-identical tested HTML bundle')
def pool(buf,offset):
    assert u16(buf,offset)==1
    count=u32(buf,offset+8);flags=u32(buf,offset+16);start=u32(buf,offset+20);assert not flags&0x100
    result=[]
    for i in range(count):
        p=offset+start+u32(buf,offset+28+4*i);n=u16(buf,p);assert n<0x8000
        result.append(buf[p+2:p+2+2*n].decode('utf-16le'))
    return result
assert u16(axml)==3 and u32(axml,4)==len(axml)
pos=8;strings=[];resources=[];elements=[];stack=[];manifest_data={}
while pos<len(axml):
    kind=u16(axml,pos);header=u16(axml,pos+2);length=u32(axml,pos+4);assert length>=header and pos+length<=len(axml)
    if kind==1:strings=pool(axml,pos)
    elif kind==0x180:resources=[u32(axml,p) for p in range(pos+8,pos+length,4)]
    elif kind==0x102:
        name=strings[u32(axml,pos+20)];elements.append(name);stack.append(name);attrs={}
        for i in range(u16(axml,pos+28)):
            p=pos+16+u16(axml,pos+24)+i*u16(axml,pos+26)
            ns,ni,raw=struct.unpack_from('<III',axml,p);typ=axml[p+15];data=u32(axml,p+16)
            attrs[strings[ni]]=strings[data] if typ==3 else data
            if ns!=0xffffffff:assert ni<len(resources) and resources[ni]!=0
        manifest_data[name]=attrs
    elif kind==0x103:assert stack.pop()==strings[u32(axml,pos+20)]
    pos+=length
assert pos==len(axml) and not stack
assert 'uses-permission' not in elements
assert manifest_data['manifest']['package']=='de.gleisgasse.prototyp'
assert manifest_data['uses-sdk']=={'minSdkVersion':30,'targetSdkVersion':37}
assert manifest_data['application']['allowBackup']==0 and manifest_data['application']['debuggable']==0
assert manifest_data['activity']['exported']==0xffffffff
assert manifest_data['manifest']['versionCode']==2 and manifest_data['manifest']['versionName']=='0.2.0'
assert manifest_data['application']['theme']==0x01030241
passed('Binary Android manifest: correct package/launcher, minimum API 30, target API 37, version 0.2.0, inset-aware non-fullscreen theme, no permissions, backup/debug disabled')
assert u16(arsc)==2 and u32(arsc,4)==len(arsc) and u32(arsc,8)==1
assert pool(arsc,12)==['res/drawable/ic_launcher.png']
package=12+u32(arsc,16);assert u16(arsc,package)==0x200 and u16(arsc,package+2)==288 and u32(arsc,package+8)==0x7f
assert pool(arsc,package+u32(arsc,package+268))==['drawable']
assert pool(arsc,package+u32(arsc,package+276))==['ic_launcher']
assert package+u32(arsc,package+4)==len(arsc)
passed('Resource-table package, string pools and launcher drawable resolve')
assert dex[:8]==b'dex\n035\0'
assert u32(dex,32)==len(dex) and u32(dex,36)==112 and u32(dex,40)==0x12345678
assert dex[12:32]==hashlib.sha1(dex[32:]).digest() and u32(dex,8)==zlib.adler32(dex[12:])&0xffffffff
mapoff=u32(dex,52);mc=u32(dex,mapoff);last=-1
for i in range(mc):
    typ,unused,count,offset=struct.unpack_from('<HHII',dex,mapoff+4+i*12)
    assert unused==0 and count>0 and last<offset<len(dex);last=offset
passed('DEX header, SHA-1, Adler-32 and ordered map sections')
def leb(buf,p):
    n=0;shift=0
    while True:
        v=buf[p];p+=1;n|=(v&127)<<shift
        if v<128:return n,p
        shift+=7;assert shift<=28
ss=[]
for i in range(u32(dex,56)):
    off=u32(dex,u32(dex,60)+i*4);length,p=leb(dex,off);end=dex.index(b'\0',p);text=dex[p:end].decode();assert len(text)==length;ss.append(text)
assert ss==sorted(set(ss))
types=[u32(dex,u32(dex,68)+i*4) for i in range(u32(dex,64))];assert types==sorted(set(types));assert all(i<len(ss) for i in types)
protos=[]
for i in range(u32(dex,72)):
    short,ret,args=struct.unpack_from('<III',dex,u32(dex,76)+12*i);assert short<len(ss) and ret<len(types)
    pp=tuple(u16(dex,args+4+j*2) for j in range(u32(dex,args))) if args else ()
    assert all(i<len(types) for i in pp);protos.append((ret,pp))
assert protos==sorted(set(protos))
methods=[]
for i in range(u32(dex,88)):
    cls,proto,name=struct.unpack_from('<HHI',dex,u32(dex,92)+8*i);assert cls<len(types) and proto<len(protos) and name<len(ss);methods.append((cls,name,proto))
assert methods==sorted(set(methods))
fields=[]
for i in range(u32(dex,80)):
    cls,typ,name=struct.unpack_from('<HHI',dex,u32(dex,84)+i*8)
    assert cls<len(types) and typ<len(types) and name<len(ss)
    fields.append((cls,name,typ))
assert fields==sorted(set(fields))
passed('DEX strings/types/prototypes/fields/methods are unique, correctly sorted and in bounds')
cl=u32(dex,100);classid,access,superid,interfaces,source,annotations,classdata,staticvalues=struct.unpack_from('<8I',dex,cl)
assert ss[types[classid]]=='Lde/gleisgasse/prototyp/MainActivity;' and ss[types[superid]]=='Landroid/app/Activity;'
p=classdata;counts=[]
for _ in range(4):n,p=leb(dex,p);counts.append(n)
assert counts==[0,1,1,4]
assert u32(dex,interfaces)==1 and ss[types[u16(dex,interfaces+4)]]=='Landroid/view/View$OnApplyWindowInsetsListener;'
fieldid,p=leb(dex,p);flags,p=leb(dex,p);assert flags==2 and fields[fieldid][0]==classid and ss[fields[fieldid][1]]=='web'
codes=[]
for n in counts[2:]:
    index=0
    for i in range(n):
        delta,p=leb(dex,p);index+=delta;flags,p=leb(dex,p);co,p=leb(dex,p);assert co%4==0
        regs,ins,outs,tries,debug,count=struct.unpack_from('<HHHHII',dex,co);assert regs>=ins and tries==0 and debug==0
        words=struct.unpack_from('<'+'H'*count,dex,co+16);ip=0;starts=set();branches=[]
        while ip<count:
            starts.add(ip);op=words[ip]&255
            if op in [0x0e,0x0c,0x12,0x07,0x0a,0x11]:size=1
            elif op in [0x22,0x1a,0x5b,0x54,0x38,0x13,0x52,0x62,0x96]:size=2
            elif op in [0x6e,0x6f,0x70,0x71,0x74,0x14]:size=3
            else:raise AssertionError(f'Unexpected opcode {op:x}')
            if op in [0x6e,0x6f,0x70,0x71]:
                nargs=words[ip]>>12;assert nargs<=outs and words[ip+1]<len(methods)
                argword=words[ip+2];rr=[argword&15,(argword>>4)&15,(argword>>8)&15,(argword>>12)&15,(words[ip]>>8)&15][:nargs]
                assert all(r<regs for r in rr)
                m=methods[words[ip+1]];assert nargs==(0 if op==0x71 else 1)+len(protos[m[2]][1])
            elif op==0x74:assert (words[ip]>>8)<=outs and words[ip+2]+(words[ip]>>8)<=regs
            elif op==0x38:branches.append(ip+words[ip+1])
            elif op==0x1a:assert words[ip+1]<len(ss)
            elif op==0x22:assert words[ip+1]<len(types)
            elif op in [0x5b,0x54,0x52,0x62]:
                assert words[ip+1]<len(fields)
                if op!=0x62:assert ((words[ip]>>8)&15)<regs and (words[ip]>>12)<regs
                else:assert (words[ip]>>8)<regs
            elif op==0x96:
                assert (words[ip]>>8)<regs and (words[ip+1]&255)<regs and (words[ip+1]>>8)<regs
            ip+=size
        assert ip==count and all(target in starts for target in branches)
        assert words[-1]==(0x11 if ss[methods[index][1]]=='onApplyWindowInsets' else 0x0e)
        codes.append(ss[methods[index][1]])
assert set(codes)=={'<init>','onCreate','onPause','onResume','onApplyWindowInsets'}
passed('All five Activity methods including window-insets callback: code bounds, method argument counts, registers, branch targets and returns')
report={'apk':file.name,'size_bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'checks':checks,'manifest':manifest_data,'signing_certificate_sha256':hashlib.sha256(cert_der).hexdigest(),
        'not_tested':['Installation and ART verification on a real Android device/emulator','Native WebView rendering and localStorage persistence on the user device']}
(ROOT/'tests/apk-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(f'\n{len(checks)} package verification groups passed. Android runtime validation is still required.')
