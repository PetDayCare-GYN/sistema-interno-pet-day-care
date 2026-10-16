// Middleware de autenticação por sessão (login próprio e-mail+senha).
//
// Em produção o Worker é exposto diretamente (sem o proxy da OpenAI que antes
// injetava os headers de identidade). Então, por request:
//   1) REMOVE qualquer header `oai-authenticated-user-*` vindo do cliente
//      (impede falsificação de identidade);
//   2) valida o cookie `pet_session` contra a tabela `sessions` e, se válido,
//      injeta `oai-authenticated-user-id` / `oai-authenticated-user-email` do
//      usuário — os mesmos headers que lib/business.mjs (currentUser) já lê.
//
// Os testes chamam handleApi diretamente (sem este middleware), então continuam
// podendo passar os headers de identidade — nada quebra.

const SESSION_COOKIE = "pet_session";
// Janela de inatividade: a sessão vale 7 dias a partir do último uso. Cada
// requisição autenticada empurra `expires_at` para frente; 7 dias sem nenhuma
// requisição → a sessão expira e exige login de novo.
const SESSION_TTL_MS = 604800000; // 7 dias
// Só grava a renovação quando passou mais de 1h desde a última, para não gerar
// uma escrita no banco a cada requisição.
const SESSION_RENEW_AFTER_MS = 3600000; // 1 hora

async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

function readCookie(request, name) {
  const match = (request.headers.get("cookie") || "").match(
    new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"),
  );
  return match ? match[1] : null;
}

export async function authenticate(request, env) {
  const headers = new Headers(request.headers);
  // (1) Descarta identidade enviada pelo cliente — só o servidor pode defini-la.
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("oai-authenticated-user-")) {
      headers.delete(name);
    }
  }
  // (2) Resolve a sessão a partir do cookie.
  const token = readCookie(request, SESSION_COOKIE);
  if (token && env?.DB) {
    try {
      const tokenHash = await sha256Hex(token);
      const row = await env.DB.prepare(
        "SELECT s.id AS session_id, s.expires_at AS expires_at, u.id AS id, u.email AS email, u.active AS active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
      )
        .bind(tokenHash, new Date().toISOString())
        .first();
      if (row && row.active) {
        headers.set("oai-authenticated-user-id", String(row.id));
        headers.set("oai-authenticated-user-email", String(row.email));
        // Renova a janela de inatividade (deslizante). Só escreve se passou mais
        // de 1h desde a última renovação, evitando uma gravação por requisição.
        const remaining = new Date(row.expires_at).getTime() - Date.now();
        if (remaining < SESSION_TTL_MS - SESSION_RENEW_AFTER_MS) {
          try {
            await env.DB.prepare(
              "UPDATE sessions SET expires_at=? WHERE id=?",
            )
              .bind(new Date(Date.now() + SESSION_TTL_MS).toISOString(), row.session_id)
              .run();
          } catch {
            // Falha ao renovar não deve negar acesso: a sessão segue válida até
            // o `expires_at` atual. A próxima requisição tenta renovar de novo.
          }
        }
      }
    } catch {
      // Falha ao resolver a sessão → segue como anônimo (o gate de /api cuida).
    }
  }
  // Reconstrói a partir de request.url (string). NÃO usar `new Request(request,
  // init)`: o request entregue pelo framework pode não ser uma instância real de
  // Request, e o construtor trataria o 1º argumento como URL ("[object Request]").
  const method = request.method;
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(request.url, init);
}
