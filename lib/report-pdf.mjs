import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {reportLabels,formatReportValue} from './report-fields.mjs';
export async function reportPdf(ctx,title,records,allColumns,meta) {
 const document=await PDFDocument.create(),font=await document.embedFont(StandardFonts.Helvetica),bold=await document.embedFont(StandardFonts.HelveticaBold);
 document.setTitle(title);document.setAuthor(ctx.organization.name);document.setSubject(meta.from+' a '+meta.to);document.setCreator('Pet Day Care');
 const theme=JSON.parse(ctx.organization.theme),color=hex=>{const v=hex.replace('#','');return rgb(parseInt(v.slice(0,2),16)/255,parseInt(v.slice(2,4),16)/255,parseInt(v.slice(4,6),16)/255);};
 const primary=color(theme.primary),ink=rgb(.12,.18,.16),muted=rgb(.38,.43,.4),line=rgb(.86,.9,.87);
 const charset=new Set(font.getCharacterSet());
 const safe=value=>[...String(value)].map(c=>charset.has(c.codePointAt(0))?c:'[U+'+c.codePointAt(0).toString(16).toUpperCase()+']').join('').replace(/[\r\n\t]/g,' ');
 const fit=(value,width,size,face=font)=>{let text=safe(value);if(face.widthOfTextAtSize(text,size)<=width)return text;while(text&&face.widthOfTextAtSize(text+'...',size)>width)text=text.slice(0,-1);return text+'...';};
 const wrap=(value,width,size)=>{
  const text=safe(value),lines=[];let current='';
  for(const character of text){if(current&&font.widthOfTextAtSize(current+character,size)>width){lines.push(current.trim());current=character;}else current+=character;}
  if(current)lines.push(current.trim());return lines.length?lines:[''];
 };
 let logo=null;
 if(theme.logo_id&&ctx.env.BUCKET){const record=await ctx.one(ctx.db,"SELECT mime,object_key FROM files WHERE id=? AND kind='brand' AND removed_at IS NULL",[theme.logo_id]);if(record&&['image/png','image/jpeg'].includes(record.mime)){const object=await ctx.env.BUCKET.get(record.object_key||'files/'+theme.logo_id);if(object){const bytes=new Uint8Array(await new Response(object.body).arrayBuffer());logo=record.mime==='image/png'?await document.embedPng(bytes):await document.embedJpg(bytes);}}}
 const columns=allColumns.filter(k=>!['rule','pricing','snapshot','permissions','identity_id','technical_hash'].includes(k));
 const pictures=new Map();let pictureBytes=0;const photoColumn=columns.includes('pet_identity');
 if(photoColumn)for(const record of records){const id=record.pet_identity?.photo_id;if(!id||pictures.has(id))continue;const file=await ctx.one(ctx.db,"SELECT * FROM files WHERE id=? AND kind='photo' AND removed_at IS NULL",[id]);if(!file||!['image/png','image/jpeg'].includes(file.mime))continue;pictureBytes+=file.size;ctx.need(pictureBytes<=20*1024*1024,'As fotos deste PDF excedem 20 MB. Reduza os filtros ou use CSV.',413);const object=await ctx.env.BUCKET?.get(file.object_key||'files/'+id);if(!object)continue;const bytes=new Uint8Array(await new Response(object.body).arrayBuffer());if(file.mime==='image/png'){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);ctx.need(bytes.length>=24&&view.getUint32(16)*view.getUint32(20)<=6000000,'Uma fotografia PNG deste PDF excede 6 megapixels. Use JPEG ou uma versão PNG de menor resolução para exportar com fotos.',413);}pictures.set(id,file.mime==='image/png'?await document.embedPng(bytes):await document.embedJpg(bytes));}
 const groups=[];const identity=columns.includes('id')?'id':columns.includes('pet_id')?'pet_id':null;const repeated=[...(photoColumn?['pet_identity']:[]),...(identity?[identity]:[])],remaining=columns.filter(k=>!repeated.includes(k)),perGroup=7-repeated.length;for(let i=0;i<remaining.length;i+=perGroup)groups.push([...repeated,...remaining.slice(i,i+perGroup)]);if(!groups.length)groups.push(repeated.length?repeated:['resultado']);
 const margin=34,width=842,height=595,tableWidth=width-margin*2;let page,y;
 const newPage=(group,index)=>{
  page=document.addPage([width,height]);
  page.drawRectangle({x:0,y:height-8,width,height:8,color:primary});
  page.drawText(fit(ctx.organization.name,tableWidth-(logo?120:0),14,bold),{x:margin,y:height-38,size:14,font:bold,color:primary});
  page.drawText(safe(title),{x:margin,y:height-61,size:12,font:bold,color:ink});
  const subtitle=`${formatReportValue('day',meta.from)} a ${formatReportValue('day',meta.to)} | ${records.length} registros${groups.length>1?' | Colunas '+(index+1)+'/'+groups.length:''}`;
  page.drawText(safe(subtitle),{x:margin,y:height-78,size:9,font,color:muted});
  if(logo){const ratio=Math.min(105/logo.width,45/logo.height);page.drawImage(logo,{x:width-margin-logo.width*ratio,y:height-58,width:logo.width*ratio,height:logo.height*ratio});}
  y=height-103;
  const cellWidth=tableWidth/group.length,headerLines=group.map(k=>wrap(reportLabels[k]||k,cellWidth-12,8));
  const headerHeight=Math.max(...headerLines.map(l=>l.length))*11+12;
  page.drawRectangle({x:margin,y:y-headerHeight,width:tableWidth,height:headerHeight,color:primary});
  headerLines.forEach((lines,j)=>lines.forEach((text,n)=>page.drawText(text,{x:margin+j*cellWidth+6,y:y-12-n*11,size:8,font:bold,color:rgb(1,1,1)})));
  y-=headerHeight;
 };
 for(let groupIndex=0;groupIndex<groups.length;groupIndex++){
  const group=groups[groupIndex],cellWidth=tableWidth/group.length;newPage(group,groupIndex);
  if(!records.length){page.drawText('Nenhum registro para os filtros selecionados.',{x:margin,y:y-25,size:10,font,color:ink});continue;}
  for(const record of records){const picture=pictures.get(record.pet_identity?.photo_id);const lines=group.map(k=>k==='pet_identity'?picture?['']:wrap('Foto pendente',cellWidth-12,8):wrap(formatReportValue(k,record[k]),cellWidth-12,8));let offset=0;const count=Math.max(picture?6:1,...lines.map(l=>l.length));
   while(offset<count){if(y<70||picture&&offset===0&&y<125)newPage(group,groupIndex);const available=Math.max(1,Math.floor((y-45-12)/11)),take=Math.min(count-offset,available),rowHeight=take*11+12;
    if(picture&&offset===0){const column=group.indexOf('pet_identity');if(column>=0){const ratio=Math.min((cellWidth-16)/picture.width,54/picture.height);page.drawImage(picture,{x:margin+column*cellWidth+(cellWidth-picture.width*ratio)/2,y:y-8-picture.height*ratio,width:picture.width*ratio,height:picture.height*ratio});}}
    lines.forEach((texts,j)=>texts.slice(offset,offset+take).forEach((text,n)=>page.drawText(text,{x:margin+j*cellWidth+6,y:y-12-n*11,size:8,font,color:ink})));
    page.drawLine({start:{x:margin,y:y-rowHeight},end:{x:width-margin,y:y-rowHeight},thickness:.5,color:line});y-=rowHeight;offset+=take;
   }
  }
 }
 const pages=document.getPages();pages.forEach((p,index)=>{p.drawText(safe('Emitido em '+formatReportValue('created_at',meta.as_of)+' | '+ctx.user.name),{x:margin,y:22,size:8,font,color:muted});p.drawText(`${index+1} / ${pages.length}`,{x:width-margin-35,y:22,size:8,font,color:muted});});
 return document.save();
}
