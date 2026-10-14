// All reservation entry points use the same configured availability rules.
export async function validateAvailability(ctx, service, start, end, userId) {
  const {db,settings,need,rows,localDate}=ctx;
  const hours=settings.opening_hours;
  const holidays=settings.closed_dates||[];
  const endpoints=service.kind==='boarding'?[start,end]:[start];
  const clock=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  const weekday=value=>new Date(localDate(new Date(value))+'T12:00:00Z').getUTCDay();
  for(const point of endpoints) {
    const day=ctx.localDate(new Date(point));
    need(!holidays.includes(day),'O estabelecimento está fechado nesta data.');
    if(hours) {
      const rule=hours[weekday(point)];
      need(rule?.enabled,'Não há atendimento neste dia da semana.');
      need(clock(point)>=rule.open&&clock(point)<=rule.close,'O horário está fora do período de atendimento.');
      if(service.kind!=='boarding')need(clock(end)<=rule.close,'A saída ultrapassa o horário de atendimento.');
    }
  }
  if(settings.require_shifts&&userId) {
    const shifts=await rows(db,'SELECT id FROM shifts WHERE user_id=? AND start_at<=? AND end_at>=?',[userId,start,end]);
    need(shifts.length>0,'O profissional não possui escala que cubra este atendimento.');
  }
}

export function validateExtraSettings(settings,need) {
  if(settings.opening_hours!=null) {
    need(Array.isArray(settings.opening_hours)&&settings.opening_hours.length===7,'Configure os sete dias da semana.');
    for(const rule of settings.opening_hours)need(typeof rule.enabled==='boolean'&&(!rule.enabled||(/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.open)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.close)&&rule.close>rule.open)),'Horário de funcionamento inválido.');
  }
  need(Array.isArray(settings.closed_dates||[])&&(settings.closed_dates||[]).length<=366&&(settings.closed_dates||[]).every(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(new Date(v))),'Feriados e datas fechadas inválidos.');
  need(settings.require_shifts==null||typeof settings.require_shifts==='boolean','Regra de escalas inválida.');
  need(settings.package_accounting==null||['sale','consumption'].includes(settings.package_accounting),'Método gerencial dos pacotes inválido.');
  if(settings.data_retention_days!=null)need(Number.isSafeInteger(settings.data_retention_days)&&settings.data_retention_days>=1&&settings.data_retention_days<=36500,'Retenção dos cadastros inválida.');
  need(settings.privacy_policy==null||typeof settings.privacy_policy==='string'&&settings.privacy_policy.length<=10000,'Política de privacidade inválida.');
  need(Array.isArray(settings.required_documents||[])&&(settings.required_documents||[]).length<=20&&(settings.required_documents||[]).every(v=>typeof v==='string'&&v.length<=100),'Documentos exigidos inválidos.');
  if(settings.alert_lead_days)for(const [type,days] of Object.entries(settings.alert_lead_days))need(['health','package','appointment','boarding','inventory','finance','task'].includes(type)&&Number.isSafeInteger(days)&&days>=0&&days<=365,'Antecedência por alerta inválida.');
}
