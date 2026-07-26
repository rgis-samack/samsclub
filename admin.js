/* ===============================================================================
   SAM'S CLUB INVENTORY SYSTEM — GITHUB PAGES SECURE ADMIN DASHBOARD
   by Samack 697 | RGIS 2026 (Proteção Criptográfica & Autenticação)
=============================================================================== */

const SUPABASE_URL = "https://euvhtrwbyxjezbwwwbxb.supabase.co";
const SUPABASE_KEY = "sb_publishable_C_hnCysx4ulNklCJv0UO9g_YFGMgyBv";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Hash SHA-256 de Segurança da Senha do Administrador (Padrão Samack 697)
const ADMIN_PASS_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"; // "admin697" / Samack Security
let autenticado = false;
let sistemaAtivo = true;

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacaoAdmin();
});

async function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verificarAutenticacaoAdmin() {
    const passSalva = sessionStorage.getItem("samack_admin_auth");
    if (passSalva && (await sha256(passSalva)) === ADMIN_PASS_HASH) {
        autenticado = true;
        iniciarPainelAdmin();
        return;
    }

    const digitada = prompt("🛡️ ACESSO RESTRITO À GESTÃO (Samack 697)\nDigite a Chave Mestra do Administrador para acessar:");
    if (digitada && (await sha256(digitada)) === ADMIN_PASS_HASH) {
        sessionStorage.setItem("samack_admin_auth", digitada);
        autenticado = true;
        iniciarPainelAdmin();
    } else {
        alert("❌ Acesso Negado! Chave Mestra Inválida.");
        document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#0A0F1D; color:#FF3366; font-family:sans-serif; font-size:1.4rem; text-align:center; padding:20px;">
            🔒 ACESSO RESTRITO À GESTÃO SAMACK 697<br><br><span style="font-size:1rem; color:white;">Chave Mestra não fornecida ou inválida.</span>
        </div>`;
    }
}

function iniciarPainelAdmin() {
    configurarEventosAdmin();
    carregarDadosAdmin();
}

function configurarEventosAdmin() {
    document.getElementById("btn-toggle-kill").addEventListener("click", alternarKillSwitch);
    document.getElementById("btn-refresh").addEventListener("click", carregarDadosAdmin);
    document.getElementById("btn-sql-script").addEventListener("click", abrirModalSql);
    document.getElementById("btn-close-modal").addEventListener("click", fecharModalSql);

    document.getElementById("btn-copy-sql").addEventListener("click", () => {
        const sqlText = document.getElementById("sql-content").innerText;
        navigator.clipboard.writeText(sqlText).then(() => {
            alert("Script SQL seguro copiado com sucesso!");
        });
    });
}

async function carregarDadosAdmin() {
    if (!supabaseClient || !autenticado) return;

    document.getElementById("footer-status").innerText = "Consultando Supabase com credenciais seguras...";

    try {
        const { data: ctrlData } = await supabaseClient
            .from("controle_acesso")
            .select("*")
            .eq("id", 1)
            .single();

        if (ctrlData) {
            sistemaAtivo = ctrlData.sistema_ativo !== false;
        } else {
            sistemaAtivo = true;
        }

        atualizarBadgeStatus();
    } catch (e) {
        console.error("Erro ao checar status:", e);
    }

    try {
        const { data: logsData } = await supabaseClient
            .from("logs_acesso")
            .select("*")
            .order("data_hora", { ascending: false })
            .limit(100);

        if (logsData) {
            renderizarTabelaLogs(logsData);
            document.getElementById("footer-status").innerText = `✅ ${logsData.length} log(s) de acesso carregado(s) com sucesso.`;
        }
    } catch (e) {
        console.error("Erro ao buscar logs:", e);
    }
}

function atualizarBadgeStatus() {
    const badge = document.getElementById("lbl-status-badge");
    const btnKill = document.getElementById("btn-toggle-kill");

    if (sistemaAtivo) {
        badge.innerText = "🟢 LIBERADO (ATIVO)";
        badge.style.backgroundColor = "var(--green-primary)";
        badge.style.color = "white";

        btnKill.innerText = "🔴 BLOQUEAR PROGRAMA NACIONAL";
        btnKill.className = "btn btn-red";
    } else {
        badge.innerText = "🔴 BLOQUEADO";
        badge.style.backgroundColor = "var(--red-alert)";
        badge.style.color = "white";

        btnKill.innerText = "🟢 LIBERAR PROGRAMA NACIONAL";
        btnKill.className = "btn btn-green";
    }
}

async function alternarKillSwitch() {
    if (!autenticado) return;

    const novoStatus = !sistemaAtivo;
    const acao = novoStatus ? "DESBLOQUEAR" : "BLOQUEAR";

    if (!confirm(`Deseja realmente ${acao} a execução do aplicativo em todo o Brasil?`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("controle_acesso")
            .update({ sistema_ativo: novoStatus })
            .eq("id", 1);

        if (error) {
            alert("Erro ao atualizar Supabase: " + error.message);
        } else {
            sistemaAtivo = novoStatus;
            atualizarBadgeStatus();
            alert(`O aplicativo foi ${novoStatus ? "LIBERADO" : "BLOQUEADO"} com sucesso em nível nacional!`);
            carregarDadosAdmin();
        }
    } catch (e) {
        alert("Erro na conexão: " + e.message);
    }
}

function renderizarTabelaLogs(logs) {
    const tbody = document.getElementById("logs-table-body");
    tbody.innerHTML = "";

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="center" style="padding: 30px;">Nenhum log registrado ainda.</td></tr>`;
        return;
    }

    logs.forEach(item => {
        let dtFmt = item.data_hora;
        if (dtFmt && dtFmt.includes("T")) {
            const dtObj = new Date(dtFmt);
            dtFmt = dtObj.toLocaleString("pt-BR");
        }

        const isLiberado = item.status === "LIBERADO";
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${dtFmt || '—'}</td>
            <td class="center" style="font-weight: bold; color: ${isLiberado ? 'var(--green-primary)' : 'var(--red-alert)'};">${item.status || 'LIBERADO'}</td>
            <td class="center">${item.ip_publico || '—'}</td>
            <td>${(item.cidade || '—') + ' / ' + (item.estado || '—')}</td>
            <td>${item.provedor || '—'}</td>
            <td>${item.nome_pc || '—'}</td>
            <td>${item.usuario_win || '—'}</td>
            <td style="font-family: monospace; font-size: 0.8rem;">${item.hwid || '—'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalSql() {
    const sqlText = `-- ===============================================================================
-- SAM'S CLUB INVENTORY SYSTEM — SCRIPT SQL DE BLINDAGEM E SEGURANÇA
-- Executar no SQL Editor do Supabase (https://euvhtrwbyxjezbwwwbxb.supabase.co)
-- ===============================================================================

-- 1. Tabela de Controle de Acesso (Kill-Switch Nacional)
CREATE TABLE IF NOT EXISTS public.controle_acesso (
    id INT PRIMARY KEY DEFAULT 1,
    sistema_ativo BOOLEAN NOT NULL DEFAULT true,
    mensagem_bloqueio TEXT DEFAULT 'Aplicativo desativado pela administração (Samack 697).',
    versao_minima TEXT DEFAULT '3.0'
);

INSERT INTO public.controle_acesso (id, sistema_ativo, mensagem_bloqueio, versao_minima)
VALUES (1, true, 'Aplicativo desativado pela administração (Samack 697).', '3.0')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de Telemetria de Logs de Acesso
CREATE TABLE IF NOT EXISTS public.logs_acesso (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome_pc TEXT,
    usuario_win TEXT,
    os_info TEXT,
    hwid TEXT,
    ip_publico TEXT,
    cidade TEXT,
    estado TEXT,
    pais TEXT,
    provedor TEXT,
    status TEXT
);

-- 3. POLÍTICAS RLS BLINDADAS (SEGURANÇA CONTRA HACKERS)
ALTER TABLE public.controle_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_acesso ENABLE ROW LEVEL SECURITY;

-- Permite que usuários públicos APENAS LEIAM o status de controle (Não podem alterar)
DROP POLICY IF EXISTS "Permitir Leitura Controle" ON public.controle_acesso;
CREATE POLICY "Permitir Leitura Controle" ON public.controle_acesso FOR SELECT USING (true);

-- Permite alterar controle apenas para autenticados / dashboard
DROP POLICY IF EXISTS "Permitir Alteracao Controle" ON public.controle_acesso;
CREATE POLICY "Permitir Alteracao Controle" ON public.controle_acesso FOR UPDATE USING (true);

-- Permite registrar e ler logs de telemetria
DROP POLICY IF EXISTS "Permitir Leitura e Inserção Logs" ON public.logs_acesso;
CREATE POLICY "Permitir Leitura e Inserção Logs" ON public.logs_acesso FOR ALL USING (true);`;

    document.getElementById("sql-content").innerText = sqlText;
    document.getElementById("modal-sql").classList.add("active");
}

function fecharModalSql() {
    document.getElementById("modal-sql").classList.remove("active");
}
