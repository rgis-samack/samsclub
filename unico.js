// unico.js - Gerador de Crachá Único (Horizontal / A4 Landscape)
// Estrutura espelhada do modelo Excel "Modelo cracha V3.xlsm"

function gerarPdfUnico(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    
    if (typeof processedCrachas === "undefined" || processedCrachas.length === 0) {
        alert("Nenhum dado processado! Cole dados na tabela primeiro.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    // Pega limites de intervalo se houver
    const inInicio = document.getElementById('input-inicio');
    const inFim = document.getElementById('input-fim');
    const vInicio = inInicio && inInicio.value.trim() ? parseInt(inInicio.value, 10) : 0;
    const vFim = inFim && inFim.value.trim() ? parseInt(inFim.value, 10) : 999999;

    let dadosParaImprimir = [];
    processedCrachas.forEach(tag => {
        const tNum = parseInt(tag.tag, 10);
        if (isNaN(tNum) || (tNum >= vInicio && tNum <= vFim)) {
            // Expande cada produto para uma página única
            tag.produtos.forEach(prod => {
                dadosParaImprimir.push({
                    tag: tag.tag,
                    nome: tag.nome,
                    codigo: prod.codigo,
                    descricao: prod.descricao,
                    quantidade: prod.quantidade
                });
            });
        }
    });

    if (dadosParaImprimir.length === 0) {
        alert("Nenhum crachá encontrado no intervalo selecionado.");
        return;
    }

    for (let i = 0; i < dadosParaImprimir.length; i++) {
        if (i > 0) doc.addPage();
        const isFirstOrLast = (i === 0 || i === dadosParaImprimir.length - 1);
        desenharCrachaUnicoExact(doc, dadosParaImprimir[i], isFirstOrLast);
    }

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Atualiza botões secundários
    const btnAbrir = document.getElementById('btn-abrir-pdf');
    const btnImprimir = document.getElementById('btn-imprimir-pdf');
    if (btnAbrir) {
        btnAbrir.disabled = false;
        btnAbrir.onclick = () => window.open(pdfUrl, '_blank');
    }
    if (btnImprimir) {
        btnImprimir.disabled = false;
        btnImprimir.onclick = () => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = pdfUrl;
            document.body.appendChild(iframe);
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        };
    }

    window.open(pdfUrl, '_blank');
}

function desenharCrachaUnicoExact(doc, data, drawBranding) {
    // Dimensões A4 Landscape: 842 x 595 pt
    const margin = 30;
    const width = 842 - margin * 2; // 782 pt
    const height = 595 - margin * 2; // 535 pt
    const leftX = margin;
    const rightX = margin + width;

    if (drawBranding) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16); // Maior que o original (que era 12)
        doc.setTextColor(0, 45, 98); // Azul escuro original
        doc.text("by Samack 697", leftX, margin - 10);
        doc.setTextColor(0, 0, 0); // Reset para preto
    }

    // Divisões Horizontais exatas
    const yTop = margin;
    const y1 = yTop + 80;
    const y2 = y1 + 50;
    const y3 = y2 + 150;
    const y4 = y3 + 50;
    const y5 = y4 + 130;
    const yBottom = yTop + height;

    // Retângulo externo principal
    doc.setLineWidth(2);
    doc.rect(leftX, yTop, width, height);

    // Linhas horizontais internas
    doc.setLineWidth(1.2);
    doc.line(leftX, y1, rightX, y1);
    doc.line(leftX, y2, rightX, y2);
    doc.line(leftX, y3, rightX, y3);
    doc.line(leftX, y4, rightX, y4);
    doc.line(leftX, y5, rightX, y5);

    // ROW 1: TAG (Tamanho Excel: 72 Bold / 48 Normal)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.text("TAG", leftX + width * 0.48, yTop + 62, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(48);
    doc.text(String(data.tag || ""), rightX - 30, yTop + 58, { align: "right" });

    // ROW 2: NOME: (Tamanho Excel: 48 Normal / 26 Normal)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(48);
    doc.text("NOME:", leftX + 15, y1 + 38);

    doc.setFontSize(26);
    doc.text(String(data.nome || ""), leftX + 200, y1 + 32);

    // ROW 3: DESCRIÇÃO (Tamanho Excel: 24 Normal / 48 Normal)
    doc.setFontSize(24);
    doc.text("DESCRIÇÃO", leftX + width / 2, y2 + 28, { align: "center" });

    drawAutoFitText(doc, String(data.descricao || ""), leftX + width / 2, y2 + 105, 48, width - 40, "center");

    // ROW 4: PRODUTO / QUANTIDADE (Tamanho Excel: 26 Normal)
    doc.setFontSize(26);
    doc.text("PRODUTO", leftX + width * 0.35, y3 + 34, { align: "right" });
    doc.text("QUANTIDADE", leftX + width * 0.75, y3 + 34, { align: "center" });

    // ROW 5: CÓDIGO / QUANTIDADE Valores (Tamanho Excel: 72 Normal)
    doc.setFontSize(72);
    drawAutoFitText(doc, String(data.codigo || ""), leftX + width * 0.28, y4 + 92, 72, width * 0.45, "center");
    drawAutoFitText(doc, String(data.quantidade || ""), leftX + width * 0.75, y4 + 92, 72, width * 0.35, "center");

    // ROW 6: VALIDADE (Tamanho Excel: 26 Normal)
    doc.setFontSize(26);
    doc.text("VALIDADE", leftX + 80, y5 + 45);
    doc.text("__________/__________/_______________", leftX + 240, y5 + 45);
}

function drawAutoFitText(doc, text, x, y, maxFontSize, maxWidth, align = "left") {
    if (!text) return;
    let size = maxFontSize;
    doc.setFontSize(size);
    while (doc.getTextWidth(text) > maxWidth && size > 12) {
        size -= 2;
        doc.setFontSize(size);
    }
    doc.text(text, x, y, { align: align });
}
