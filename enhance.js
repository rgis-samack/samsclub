/* ===============================================================================
   enhance.js — camada de realce visual (não funcional)
   Só observa mudanças que app.js/unico.js já fazem no DOM e adiciona
   transições fluidas. Não lê arquivos, não coleta dados, não chama rede.
=============================================================================== */
(function () {
    'use strict';

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    /* ---------------------------------------------------------------------
       1. Status da planilha: pulso + troca de cor quando o texto muda
    ------------------------------------------------------------------------ */
    function enhanceStatus() {
        var text = document.getElementById('status-text');
        var box = document.getElementById('status-badge-box');
        if (!text || !box) return;

        var lastSeen = text.textContent;
        var obs = new MutationObserver(function () {
            var now = text.textContent;
            if (now === lastSeen) return;
            lastSeen = now;

            var loaded = /✅/.test(now);
            box.classList.toggle('is-loaded', loaded);
            box.classList.remove('status-flash');
            void box.offsetWidth;
            box.classList.add('status-flash');
        });
        obs.observe(text, { characterData: true, childList: true, subtree: true });
    }

    /* ---------------------------------------------------------------------
       2. Métricas: pequena animação de contagem + pulso quando o valor muda
    ------------------------------------------------------------------------ */
    function enhanceMetric(id) {
        var el = document.getElementById(id);
        if (!el) return;

        var tweening = false;
        var lastNumber = parseFirstNumber(el.textContent);

        var obs = new MutationObserver(function () {
            if (tweening) return;
            var targetText = el.textContent;
            var targetNumber = parseFirstNumber(targetText);
            if (targetNumber === null || targetNumber === lastNumber) {
                pulse(el);
                lastNumber = targetNumber;
                return;
            }
            tween(el, lastNumber || 0, targetNumber, targetText, function () {
                tweening = false;
                lastNumber = targetNumber;
            });
            tweening = true;
        });
        obs.observe(el, { characterData: true, childList: true, subtree: true });
    }

    function parseFirstNumber(str) {
        var m = String(str).replace(/\./g, '').match(/-?\d+/);
        return m ? parseInt(m[0], 10) : null;
    }

    function pulse(el) {
        el.classList.remove('metric-pulse');
        void el.offsetWidth;
        el.classList.add('metric-pulse');
    }

    function tween(el, from, to, finalText, done) {
        var suffix = finalText.replace(/^[\d.\s-]+/, '');
        var duration = 420;
        var start = performance.now();
        pulse(el);

        function frame(now) {
            var p = Math.min(1, (now - start) / duration);
            var eased = 1 - Math.pow(1 - p, 3);
            var current = Math.round(from + (to - from) * eased);
            el.textContent = current.toLocaleString('pt-BR') + (suffix || '');
            if (p < 1) {
                requestAnimationFrame(frame);
            } else {
                el.textContent = finalText;
                done();
            }
        }
        requestAnimationFrame(frame);
    }

    /* ---------------------------------------------------------------------
       3. Linhas da tabela: entrada em cascata suave
    ------------------------------------------------------------------------ */
    function enhanceTableRows() {
        var body = document.getElementById('table-body');
        if (!body) return;

        var obs = new MutationObserver(function (mutations) {
            var index = 0;
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1 || node.tagName !== 'TR') return;
                    var delay = Math.min(index, 24) * 14;
                    node.style.animationDelay = delay + 'ms';
                    node.classList.add('row-in');
                    index++;
                });
            });
        });
        obs.observe(body, { childList: true });
    }

    /* ---------------------------------------------------------------------
       4. Alternância tabela / estado vazio: fade suave em vez de corte seco
    ------------------------------------------------------------------------ */
    function enhanceVisibilitySwap(id) {
        var el = document.getElementById(id);
        if (!el) return;

        var obs = new MutationObserver(function () {
            var visible = el.style.display !== 'none';
            if (!visible) return;
            el.style.opacity = '0';
            requestAnimationFrame(function () {
                el.style.transition = 'opacity 0.35s cubic-bezier(0.22,1,0.36,1)';
                requestAnimationFrame(function () {
                    el.style.opacity = '1';
                });
            });
        });
        obs.observe(el, { attributes: true, attributeFilter: ['style'] });
    }

    onReady(function () {
        enhanceStatus();
        ['val-total-itens', 'val-total-areas', 'val-pags-duplo', 'val-pags-unico'].forEach(enhanceMetric);
        enhanceTableRows();
        enhanceVisibilitySwap('data-table');
        enhanceVisibilitySwap('empty-state-container');
    });
})();
