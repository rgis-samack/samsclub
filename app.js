/* ===============================================================================
   SAM'S CLUB INVENTORY SYSTEM — GITHUB PAGES JAVASCRIPT ENGINE
   by Samack 697 | RGIS 2026
=============================================================================== */

const SUPABASE_URL = "https://euvhtrwbyxjezbwwwbxb.supabase.co";
const SUPABASE_KEY = "sb_publishable_C_hnCysx4ulNklCJv0UO9g_YFGMgyBv";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Estado da Aplicação
let rawDataRows = [];
let processedCrachas = [];
let currentPdfBlobUrl = null;
let logoBase64 = null;

// 1. Inicialização do App com Proteção Anti-Inspeção
document.addEventListener("DOMContentLoaded", () => {
    carregarLogoBase64();
    configurarDragAndDrop();
    configurarEventos();
    verificarAcessoSupabase();
    ativarProtecaoAntiCopia();
});

function ativarProtecaoAntiCopia() {
    // Desativa menu de contexto de clique direito
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    
    // Bloqueia atalhos F12, Ctrl+U, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    document.addEventListener("keydown", (e) => {
        if (e.key === "F12" || 
            (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) || 
            (e.ctrlKey && e.key.toUpperCase() === "U")) {
            e.preventDefault();
        }
    });
}

// Carrega o logo 2138138.png para embutir no PDF vetorial do browser
function carregarLogoBase64() {
    const img = new Image();
    img.src = "2138138.png";
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        logoBase64 = canvas.toDataURL("image/png");
    };
}

// 2. Trava Remota & Telemetria no Supabase (Web Browser)
async function verificarAcessoSupabase() {
    if (!supabaseClient) return;

    try {
        // Checa Kill-Switch
        const { data: ctrlData, error: ctrlErr } = await supabaseClient
            .from("controle_acesso")
            .select("*")
            .eq("id", 1)
            .single();

        if (ctrlData && ctrlData.sistema_ativo === false) {
            alert(`🔴 ACESSO SUSPENSO: ${ctrlData.mensagem_bloqueio || 'Aplicativo desativado pela administração (Samack 697).'}`);
            document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#0A0F1D; color:#FF3366; font-family:sans-serif; font-size:1.5rem; text-align:center; padding:20px;">
                🔴 ACESSO SUSPENSO<br><br><span style="font-size:1.1rem; color:white;">${ctrlData.mensagem_bloqueio || 'Aplicativo desativado pela administração (Samack 697).'}</span>
            </div>`;
            return;
        }

        // Obtém Telemetria de IP e Geo via ip-api.com
        fetch("https://ip-api.com/json/?fields=query,city,regionName,country,isp")
            .then(res => res.json())
            .then(geo => {
                const hwidWeb = "WEB-" + btoa(navigator.userAgent + screen.width + screen.height).substring(0, 16);
                supabaseClient.from("logs_acesso").insert([{
                    data_hora: new Date().toISOString(),
                    nome_pc: "Navegador Web (" + (navigator.platform || "Web") + ")",
                    usuario_win: "Usuário Web",
                    os_info: navigator.userAgent.substring(0, 60),
                    hwid: hwidWeb,
                    ip_publico: geo.query || "Desconhecido",
                    cidade: geo.city || "Desconhecida",
                    estado: geo.regionName || "—",
                    pais: geo.country || "Brasil",
                    provedor: geo.isp || "—",
                    status: "LIBERADO"
                }]).then(() => {});
            }).catch(() => {});

    } catch (e) {
        console.warn("Aviso na conexão Supabase:", e);
    }
}

// 3. Suporte a Drag & Drop em Toda a Tela
function configurarDragAndDrop() {
    const overlay = document.getElementById("drag-overlay");

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
        overlay.classList.add("drag-active");
    });

    window.addEventListener("dragleave", (e) => {
        if (e.relatedTarget === null) {
            overlay.classList.remove("drag-active");
        }
    });

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        overlay.classList.remove("drag-active");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processarArquivo(e.dataTransfer.files[0]);
        }
    });
}

// 4. Configuração dos Eventos dos Botões
function configurarEventos() {
    const btnSelect = document.getElementById("btn-file-select");
    const fileInput = document.getElementById("file-input");

    btnSelect.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            processarArquivo(e.target.files[0]);
        }
    });

    document.getElementById("btn-gerar-duplo").addEventListener("click", () => gerarPdfWeb(true));
    document.getElementById("btn-gerar-unico").addEventListener("click", () => gerarPdfWeb(false));

    document.getElementById("btn-abrir-pdf").addEventListener("click", () => {
        if (currentPdfBlobUrl) window.open(currentPdfBlobUrl, "_blank");
    });

    document.getElementById("btn-imprimir-pdf").addEventListener("click", () => {
        if (currentPdfBlobUrl) {
            const printWin = window.open(currentPdfBlobUrl, "_blank");
            if (printWin) {
                printWin.focus();
                printWin.print();
            }
        }
    });

    document.getElementById("input-inicio").addEventListener("input", atualizarListaFiltrada);
    document.getElementById("input-fim").addEventListener("input", atualizarListaFiltrada);
}

// 5. Leitura e Parse da Planilha (.csv, .xlsx, .xlsm) via SheetJS
function processarArquivo(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

            rawDataRows = jsonRows;
            processarLinhasFormatadas(jsonRows, file.name);
        } catch (err) {
            alert("Erro ao ler planilha: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function processarLinhasFormatadas(rows, fileName) {
    if (!rows || rows.length < 2) {
        alert("Planilha vazia ou formato inválido.");
        return;
    }

    // Busca índice das colunas
    const headers = rows[0].map(h => String(h).toUpperCase().trim());
    let idxTag = headers.findIndex(h => h.includes("TAG") || h.includes("ÁREA") || h.includes("AREA"));
    let idxNome = headers.findIndex(h => h.includes("NOME") || h.includes("CONTADOR") || h.includes("RESPONSAVEL"));
    let idxCod = headers.findIndex(h => h.includes("CÓDIGO") || h.includes("CODIGO") || h.includes("PRODUTO") || h.includes("SKU"));
    let idxDesc = headers.findIndex(h => h.includes("DESCRIÇÃO") || h.includes("DESCRICAO") || h.includes("NOME DO PRODUTO"));
    let idxQtd = headers.findIndex(h => h.includes("QTD") || h.includes("QUANTIDADE"));

    if (idxTag === -1) idxTag = 0;
    if (idxNome === -1) idxNome = 1;
    if (idxCod === -1) idxCod = 2;
    if (idxDesc === -1) idxDesc = 3;
    if (idxQtd === -1) idxQtd = 4;

    // Agrupa por TAG (Área)
    const mapCrachas = new Map();

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;

        let tagVal = String(r[idxTag] || "").trim();
        if (!tagVal) continue;
        if (tagVal.length < 5 && !isNaN(tagVal)) {
            tagVal = tagVal.padStart(5, "0");
        }

        let nomeVal = String(r[idxNome] || "AUXILIAR").trim();
        let codVal = String(r[idxCod] || "").trim();
        let descVal = String(r[idxDesc] || "").trim();
        let qtdVal = String(r[idxQtd] || "").trim();

        if (!codVal && !descVal) continue;

        const key = `${tagVal}_${nomeVal}`;
        if (!mapCrachas.has(key)) {
            mapCrachas.set(key, { tag: tagVal, nome: nomeVal, produtos: [] });
        }
        mapCrachas.get(key).produtos.push({ codigo: codVal, descricao: descVal, quantidade: qtdVal });
    }

    processedCrachas = Array.from(mapCrachas.values());

    // Ordenação Sequencial Estrita por TAG (Área)
    processedCrachas.sort((a, b) => {
        const numA = parseInt(a.tag, 10);
        const numB = parseInt(b.tag, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.tag.localeCompare(b.tag);
    });

    document.getElementById("status-text").innerText = `✅ ${processedCrachas.length} TAG(s) carregada(s) a partir de: ${fileName}`;
    document.getElementById("status-text").style.color = "var(--green-primary)";
    document.getElementById("status-text").style.fontWeight = "bold";

    atualizarListaFiltrada();
}

function atualizarListaFiltrada() {
    const inicio = document.getElementById("input-inicio").value.trim();
    const fim = document.getElementById("input-fim").value.trim();

    let filtrados = processedCrachas;
    if (inicio || fim) {
        const numIni = inicio ? parseInt(inicio, 10) : 0;
        const numFim = fim ? parseInt(fim, 10) : 999999;

        filtrados = processedCrachas.filter(c => {
            const numTag = parseInt(c.tag, 10);
            if (!isNaN(numTag)) return numTag >= numIni && numTag <= numFim;
            return true;
        });
    }

    // Renderiza Tabela
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    let totalProdutos = 0;
    const areasSet = new Set();

    filtrados.forEach(c => {
        areasSet.add(c.tag);
        c.produtos.forEach(p => {
            totalProdutos++;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="center"><b>${c.tag}</b></td>
                <td>${c.nome}</td>
                <td class="center">${p.codigo}</td>
                <td>${p.descricao}</td>
                <td class="center">${p.quantidade}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    // Atualiza Telemetria Grid
    const pagsDuplo = Math.ceil(filtrados.length / 2);
    const pagsUnico = filtrados.length;

    document.getElementById("val-total-itens").innerText = totalProdutos.toLocaleString("pt-BR") + " itens";
    document.getElementById("val-total-areas").innerText = areasSet.size + " Áreas";
    document.getElementById("val-pags-duplo").innerText = pagsDuplo + " págs A4";
    document.getElementById("val-pags-unico").innerText = pagsUnico + " págs A4";
}

// 6. Motor Vetorial PDF no Navegador usando jsPDF (Padrão Exato A4 Sam's Club)
function gerarPdfWeb(modoDuplo = true) {
    if (!processedCrachas || processedCrachas.length === 0) {
        alert("Carregue uma planilha antes de gerar o PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    const inicio = document.getElementById("input-inicio").value.trim();
    const fim = document.getElementById("input-fim").value.trim();

    let listToRender = processedCrachas;
    if (inicio || fim) {
        const numIni = inicio ? parseInt(inicio, 10) : 0;
        const numFim = fim ? parseInt(fim, 10) : 999999;
        listToRender = processedCrachas.filter(c => {
            const numTag = parseInt(c.tag, 10);
            if (!isNaN(numTag)) return numTag >= numIni && numTag <= numFim;
            return true;
        });
    }

    if (listToRender.length === 0) {
        alert("Nenhuma área encontrada dentro do filtro especificado.");
        return;
    }

    // Coordenadas Exatas A4 ReportLab (595.28 x 841.89 pt)
    const X_LEFT = 38.3;
    const WIDTH = 505.1;
    const HEIGHT = 324.6;

    let isFirstPage = true;

    for (let i = 0; i < listToRender.length; i += (modoDuplo ? 2 : 1)) {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        // Card 1 (Topo): Y_TOP = 776.8 em ReportLab -> Em jsPDF Y_TOP de topo é (841.89 - 776.8) = 65.09 pt
        desenharCracha(doc, listToRender[i], X_LEFT, 65.09, WIDTH, HEIGHT);

        if (modoDuplo && (i + 1) < listToRender.length) {
            // Card 2 (Base): Y_TOP = 398.5 em ReportLab -> Em jsPDF Y_TOP é (841.89 - 398.5) = 443.39 pt
            desenharCracha(doc, listToRender[i + 1], X_LEFT, 443.39, WIDTH, HEIGHT);
        }
    }

    const blob = doc.output("blob");
    currentPdfBlobUrl = URL.createObjectURL(blob);

    document.getElementById("btn-abrir-pdf").disabled = false;
    document.getElementById("btn-imprimir-pdf").disabled = false;

    window.open(currentPdfBlobUrl, "_blank");
}

// Desenha o Crachá Vetorial com Auto-Fit e alinhamento do underline a 530.2 pt
function desenharCracha(doc, cracha, x, y, w, h) {
    // Retângulo Externo com Borda Navy
    doc.setDrawColor(0, 45, 98);
    doc.setLineWidth(1.5);
    doc.rect(x, y, w, h);

    // Retângulo Interno Duplo
    doc.setLineWidth(0.8);
    doc.rect(x + 3, y + 3, w - 6, h - 6);

    // Cabeçalho Navy Azul
    doc.setFillColor(0, 45, 98);
    doc.rect(x + 3, y + 3, w - 6, 42, "F");

    // Logo 2138138.png
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, "PNG", x + 15, y + 8, 65, 32);
        } catch (e) {}
    }

    // Texto Cabeçalho
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SAM'S CLUB INVENTORY SYSTEM", x + 90, y + 24);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 163, 224);
    doc.text("by Samack 697", x + w - 95, y + 38);

    // TAG (Área) e Nome do Contador
    doc.setTextColor(0, 45, 98);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`TAG: ${cracha.tag}`, x + 15, y + 70);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`NOME: ${cracha.nome}`, x + 185, y + 70);

    // Linha Separadora Horizontais
    doc.setDrawColor(0, 45, 98);
    doc.setLineWidth(1);
    doc.line(x + 10, y + 78, x + w - 10, y + 78);

    // Produtos (Até 2 Itens por Tag)
    const p1 = cracha.produtos[0] || { codigo: "", descricao: "", quantidade: "" };
    const p2 = cracha.produtos[1] || null;

    desenharBlocoProduto(doc, p1, x + 15, y + 95, w - 30);

    if (p2) {
        doc.line(x + 10, y + 185, x + w - 10, y + 185);
        desenharBlocoProduto(doc, p2, x + 15, y + 200, w - 30);
    }

    // Rodapé de Validade com Underline Exato até X = 530.2 pt
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 45, 98);
    doc.text("VALIDADE: ______/__________/___________", x + 15, y + h - 15);
}

// Auto-Fit de Descrição e Código de Produto
function desenharBlocoProduto(doc, prod, x, y, maxW) {
    // Código e Quantidade
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 45, 98);
    doc.text(`CÓDIGO: ${prod.codigo}`, x, y);
    doc.text(`QTD: ${prod.quantidade}`, x + maxW - 100, y);

    // Auto-Fit de Descrição Longa
    let fontSize = 12;
    const descText = `DESCRIÇÃO: ${prod.descricao}`;

    doc.setFontSize(fontSize);
    while (doc.getTextWidth(descText) > maxW && fontSize > 7) {
        fontSize -= 0.5;
        doc.setFontSize(fontSize);
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(descText, x, y + 20);
}
