/* =================================================================
   guard.js — Central de Acesso WGI / Wendell Global Interlining
   -----------------------------------------------------------------
   Visual alinhado ao design system (paleta vinho, Archivo).
   As cores saem dos tokens de theme.css quando a página os tiver;
   quando não tiver, caem no valor light equivalente.
   -----------------------------------------------------------------
   Como usar numa ferramenta existente: UMA linha dentro do <head>.

     <script src="https://textilegroup.github.io/wendell-users/guard.js"
             data-app="woc"></script>

   O valor de data-app é a "chave" cadastrada na Central de Acesso
   (aba Gerenciar > Ferramentas).

   Atributos opcionais na mesma tag:
     data-barra="nao"      esconde a barra de identificação no topo.
     data-tema="completo"  carrega o theme.css inteiro do padrão WGI.
     data-tema="nao"       não injeta fonte nem tokens de cor.
   Sem data-tema, o guard injeta apenas a fonte Archivo e os tokens de
   cor — a paleta fica disponível e nada da página é restilizado.

   O que ele faz, nesta ordem:
     1. esconde a página enquanto verifica;
     2. sem sessão  -> manda para o login e volta sozinho depois;
     3. sem permissão para esta ferramenta -> tela de aviso;
     4. tudo certo  -> libera a página e publica window.APP.

   Depois disso a sua ferramenta pode usar:
     APP.usuario     -> { nome, email, nivel, setor }
     APP.permissao   -> 'ver' | 'editar' | 'admin'
     APP.podeEditar()-> true/false
     APP.sair()
     await APP.pronto  -> promessa resolvida quando a checagem termina
   ================================================================= */
(function () {
  'use strict';

  var SUPABASE_URL  = 'https://eepmlsdbtcvsjxdcvimi.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_048Dv-jRALn34Ythhj9ngA_fZ1gsNI_';
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  // --- descobre a própria URL, e daí a URL do hub -----------------
  var meuSrc = (document.currentScript && document.currentScript.src) || '';
  var APP_SLUG = (document.currentScript && document.currentScript.dataset.app) || '';
  var SEM_BARRA = (document.currentScript && document.currentScript.dataset.barra) === 'nao';
  var TEMA = (document.currentScript && document.currentScript.dataset.tema) || 'tokens';
  var HUB = meuSrc ? meuSrc.replace(/guard\.js(\?.*)?$/, 'index.html') : '/wendell-users/index.html';
  var BASE = meuSrc ? meuSrc.replace(/guard\.js(\?.*)?$/, '') : '/wendell-users/';

  if (!APP_SLUG) {
    console.error('[guard] Falta data-app="chave-da-ferramenta" na tag <script>.');
  }

  /* -----------------------------------------------------------------
     LAYOUT WENDELL
     data-tema="tokens"   (padrão) fonte Archivo + tokens de cor. Não
                          restyliza nada: só disponibiliza a paleta,
                          e o CSS da própria página continua vencendo.
     data-tema="completo" carrega o theme.css inteiro do hub — use em
                          páginas que vão adotar os componentes do
                          design system (.card, .kpi, .app-header…).
     data-tema="nao"      não injeta nada.
     ----------------------------------------------------------------- */
  var TOKENS_LIGHT =
    '--wine:#7C1B29;--wine-deep:#5E1220;--wine-soft:#A5303F;' +
    '--bg:#F2F2F0;--card:#FFFFFF;--sunk:#F7F5F3;' +
    '--ink:#26252A;--ink-2:#5A555C;--ink-3:#8B858E;' +
    '--line:#E3E0DD;--line-2:#EFECE9;' +
    '--s1:#9E2438;--s2:#B8801F;--s3:#1E6FB8;--s4:#4E7A1E;' +
    '--pos:#2C6B4F;--neg:#A33A2A;--chip:#F6F4F1;' +
    '--shadow:0 1px 2px rgba(38,37,42,.06),0 1px 8px rgba(38,37,42,.04);';
  var TOKENS_DARK =
    '--wine:#8C2334;--wine-deep:#4C0E19;--wine-soft:#C4536A;' +
    '--bg:#141316;--card:#1E1C21;--sunk:#26232A;' +
    '--ink:#F0EDEA;--ink-2:#B4ADB5;--ink-3:#847D88;' +
    '--line:#332F38;--line-2:#2A272F;' +
    '--s1:#C4536A;--s2:#B8842C;--s3:#5B92E0;--s4:#6E9430;' +
    '--pos:#5FA37E;--neg:#D97A62;--chip:#2A272F;' +
    '--shadow:0 1px 2px rgba(0,0,0,.4);';

  function noTopoDoHead(el) {
    var h = document.head || document.documentElement;
    h.firstChild ? h.insertBefore(el, h.firstChild) : h.appendChild(el);
  }

  function aplicarTema() {
    if (TEMA === 'nao') return;

    // Fonte oficial do padrão.
    var f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700' +
             '&family=Archivo+Narrow:wght@400;500;600;700&display=swap';
    noTopoDoHead(f);

    if (TEMA === 'completo') {
      var t = document.createElement('link');
      t.rel = 'stylesheet';
      t.href = BASE + 'theme.css';
      noTopoDoHead(t);
      return;
    }

    // Só os tokens. Entram no topo do <head> de propósito: assim o CSS
    // da própria ferramenta continua tendo a última palavra.
    var s = document.createElement('style');
    s.setAttribute('data-guard-tema', '');
    s.textContent =
      ':root{' + TOKENS_LIGHT + '}' +
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){' + TOKENS_DARK + '}}' +
      ':root[data-theme="dark"]{' + TOKENS_DARK + '}';
    noTopoDoHead(s);
  }

  aplicarTema();

  // --- esconde a página imediatamente (sem flash de conteúdo) -----
  var estilo = document.createElement('style');
  estilo.id = '__guard_estilo';
  estilo.textContent = 'body{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(estilo);

  function liberarPagina() {
    var e = document.getElementById('__guard_estilo');
    if (e) e.remove();
  }

  function irParaLogin() {
    location.replace(HUB + '?next=' + encodeURIComponent(location.href));
  }

  var FONTE = '"Archivo","Helvetica Neue",Arial,sans-serif';

  function telaDeAviso(titulo, texto, comBotaoSair) {
    function pintar() {
      document.body.innerHTML =
        '<div style="min-height:100vh;display:grid;place-items:center;padding:24px;' +
        'font-family:' + FONTE + ';font-size:13px;line-height:1.4;' +
        'background:var(--bg,#F2F2F0);color:var(--ink,#26252A)">' +
          '<div style="width:100%;max-width:372px;background:var(--card,#FFFFFF);' +
          'border:1px solid var(--line,#E3E0DD);border-radius:12px;overflow:hidden;' +
          'box-shadow:0 1px 2px rgba(38,37,42,.06),0 8px 26px rgba(38,37,42,.09)">' +
            '<div style="padding:14px 22px;color:#fff;background:linear-gradient(100deg,' +
            'var(--wine-deep,#5E1220) 0%,var(--wine,#7C1B29) 62%,var(--wine-deep,#5E1220) 100%)">' +
              '<div style="font-size:15px;font-weight:700;line-height:1.15">Central de Acesso</div>' +
              '<div style="font-size:10.5px;opacity:.78;margin-top:1px">Wendell Global Interlining</div>' +
            '</div>' +
            '<div style="padding:24px 22px 20px">' +
              '<h2 style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.09em;' +
              'text-transform:uppercase;color:var(--wine,#7C1B29)">' + titulo + '</h2>' +
              '<p style="margin:0 0 20px;font-size:12px;color:var(--ink-2,#5A555C)">' + texto + '</p>' +
              '<a href="' + HUB + '" style="display:block;text-align:center;padding:10px;' +
              'background:var(--wine,#7C1B29);color:#fff;border-radius:8px;text-decoration:none;' +
              'font-weight:700;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase">' +
              'Ir para a Central</a>' +
              (comBotaoSair ? '<div style="text-align:center;margin-top:14px;padding-top:14px;' +
              'border-top:1px solid var(--line-2,#EFECE9)"><button onclick="APP.sair()" ' +
              'style="background:none;border:0;color:var(--ink-3,#8B858E);cursor:pointer;padding:3px;' +
              'font-family:' + FONTE + ';font-size:11.5px;font-weight:500">Sair da conta</button></div>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      liberarPagina();
    }
    document.body ? pintar()
                  : document.addEventListener('DOMContentLoaded', pintar);
  }

  function carregarSDK() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = CDN;
      s.onload = ok;
      s.onerror = function () { falha(new Error('Falha ao carregar o SDK do Supabase.')); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  var resolver, rejeitar;
  var pronto = new Promise(function (a, b) { resolver = a; rejeitar = b; });

  window.APP = {
    slug: APP_SLUG,
    hub: HUB,
    usuario: null,
    permissao: null,
    sb: null,
    pronto: pronto,
    podeEditar: function () {
      return this.permissao === 'editar' || this.permissao === 'admin';
    },
    eAdmin: function () { return this.permissao === 'admin'; },
    sair: function () {
      var cli = this.sb;
      Promise.resolve(cli && cli.auth.signOut()).then(function () {
        location.replace(HUB);
      });
    }
  };

  // --- barra de identificação no topo da ferramenta ---------------
  function montarBarra() {
    if (SEM_BARRA) return;
    function pintar() {
      var nome = (APP.usuario.nome || '').trim();
      var ini = nome.split(/\s+/).map(function (p) { return p[0] || ''; });
      ini = ((ini[0] || '?') + (ini.length > 1 ? ini[ini.length - 1] : '')).toUpperCase();
      var rot = { admin: 'acesso total', editar: 'edição', ver: 'somente leitura' };

      var b = document.createElement('div');
      b.setAttribute('data-guard-barra', '');
      b.className = 'no-print';
      b.style.cssText = 'position:sticky;top:0;z-index:99999;display:flex;align-items:center;' +
        'gap:9px;padding:6px 16px;color:#fff;font-family:' + FONTE + ';font-size:11.5px;' +
        'background:linear-gradient(100deg,var(--wine-deep,#5E1220) 0%,var(--wine,#7C1B29) 62%,' +
        'var(--wine-deep,#5E1220) 100%)';
      b.innerHTML =
        '<a href="' + HUB + '" style="color:#fff;text-decoration:none;opacity:.8;font-weight:600;' +
        'letter-spacing:.05em;text-transform:uppercase;font-size:10.5px">&#8592; Central</a>' +
        '<span style="flex:1"></span>' +
        '<span style="opacity:.7;font-size:9.5px;font-weight:700;letter-spacing:.08em;' +
        'text-transform:uppercase">' + (rot[APP.permissao] || '') + '</span>' +
        '<span style="display:flex;align-items:center;gap:7px;padding:3px 6px 3px 3px;' +
        'border:1px solid rgba(255,255,255,.35);border-radius:8px;background:rgba(255,255,255,.07)">' +
          '<span style="width:21px;height:21px;border-radius:50%;background:#fff;' +
          'color:var(--wine-deep,#5E1220);display:grid;place-items:center;font-size:9.5px;' +
          'font-weight:700">' + ini + '</span>' +
          '<span style="font-weight:600">' + nome + '</span>' +
        '</span>' +
        '<button style="border:1px solid rgba(255,255,255,.35);border-radius:8px;' +
        'background:rgba(255,255,255,.07);color:#fff;font-family:' + FONTE + ';font-size:11px;' +
        'font-weight:600;cursor:pointer;padding:5px 10px" onclick="APP.sair()">Sair</button>';
      document.body.insertBefore(b, document.body.firstChild);
    }
    document.body ? pintar()
                  : document.addEventListener('DOMContentLoaded', pintar);
  }

  // --- fluxo principal -------------------------------------------
  carregarSDK()
    .then(function () {
      APP.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      return APP.sb.auth.getSession();
    })
    .then(function (r) {
      if (!r.data.session) { irParaLogin(); return Promise.reject('sem-sessao'); }
      return Promise.all([
        APP.sb.rpc('app_perfil'),
        APP.sb.rpc('app_permissao', { p_slug: APP_SLUG })
      ]);
    })
    .then(function (res) {
      var perfil = res[0].data && res[0].data[0];
      var perm = res[1].data;

      if (res[0].error || !perfil) { irParaLogin(); return Promise.reject('sem-perfil'); }

      if (!perfil.ativo) {
        telaDeAviso('Acesso aguardando liberação',
          'Sua conta existe, mas ainda não foi ativada por um administrador.', true);
        return Promise.reject('inativo');
      }

      if (!perm) {
        telaDeAviso('Sem permissão',
          'Seu nível de acesso (<strong>' + perfil.nivel + '</strong>) não inclui esta ferramenta. ' +
          'Peça a liberação a um administrador.', true);
        return Promise.reject('sem-permissao');
      }

      APP.usuario = { nome: perfil.nome, email: perfil.email, nivel: perfil.nivel, setor: perfil.setor };
      APP.permissao = perm;

      APP.sb.rpc('app_marcar_acesso');
      montarBarra();
      liberarPagina();
      resolver(APP);

      // Sessão encerrada em outra aba -> volta para o login.
      APP.sb.auth.onAuthStateChange(function (evento) {
        if (evento === 'SIGNED_OUT') location.replace(HUB);
      });
    })
    .catch(function (e) {
      if (typeof e === 'string') { rejeitar(e); return; }   // já tratado acima
      console.error('[guard]', e);
      telaDeAviso('Não foi possível verificar o acesso',
        'Confira sua conexão e recarregue a página.', false);
      rejeitar(e);
    });
})();
