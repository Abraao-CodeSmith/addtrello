let trelloKey = '';
let trelloToken = '';
let trelloBoardId = '';

function abrirArquivoCredenciais() {
    document.getElementById('arquivoCredenciais').click();
}

function carregarCredenciais(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        const linhas = e.target.result.trim().split('\n');
        if (linhas.length < 3) {
            alert('O arquivo deve conter 3 linhas: API Key, Token e ID do Quadro');
            return;
        }

        [trelloKey, trelloToken, trelloBoardId] = linhas;

        await carregarListas();
        await carregarMembros();
        await carregarEtiquetas();
    };

    reader.readAsText(file);
}

async function carregarListas() {
    const url = `https://api.trello.com/1/boards/${trelloBoardId}/lists?key=${trelloKey}&token=${trelloToken}`;
    try {
        const resposta = await fetch(url);
        const listas = await resposta.json();

        const selectLista = document.getElementById('listaTrello');
        selectLista.innerHTML = '<option value="">Selecione uma lista</option>';

        listas.forEach(lista => {
            const option = document.createElement('option');
            option.value = lista.id;
            option.textContent = lista.name;
            selectLista.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar listas:', error);
        alert('Erro ao carregar listas do Trello.');
    }
}

async function carregarMembros() {
    const url = `https://api.trello.com/1/boards/${trelloBoardId}/members?key=${trelloKey}&token=${trelloToken}`;
    try {
        const resposta = await fetch(url);
        const membros = await resposta.json();

        const selectMembro = document.getElementById('membroTrello');
        selectMembro.innerHTML = '<option value="">Selecione um membro</option>';
        selectMembro.multiple = true; // permite seleção múltipla

        membros.forEach(membro => {
            const option = document.createElement('option');
            option.value = membro.id;
            option.textContent = membro.fullName;
            selectMembro.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar membros:', error);
        alert('Erro ao carregar membros do Trello.');
    }
}

// Carregar PDF.js
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Lida com upload do PDF
async function handlePDF(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const { data: { text } } = await Tesseract.recognize(canvas, 'por');

            //document.getElementById('debugPdf').style.display = 'block';
            document.getElementById('debugPdf').textContent = text;

            preencherCampos(text);
        } catch (error) {
            mostrarMensagem(`Erro ao ler PDF com OCR: ${error.message}`, true);
        }
    };

    reader.readAsArrayBuffer(file);
}

// Preenche os campos
function preencherCampos(texto) {
    const numPedido = extrairTexto(texto, /N[º°]?\s*[:\-]?\s*(\d{4,6})/i);
    const cliente = extrairTexto(texto, /Cliente\s*[:\-]?\s*([A-Z\s\-\&]+)/i);
    const retirada = extrairTexto(texto, /Retirada\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
    const observacoes = extrairObservacoes(texto);
    const produtos = extrairProdutos(texto);

    const descricao = [produtos, observacoes ? `\n\nObservações: ${observacoes}` : '']
        .filter(Boolean)
        .join('');

    document.getElementById('nomeCartao').value = numPedido && cliente ? `${numPedido} - ${cliente}` : '';
    document.getElementById('descricaoCartao').value = descricao;
    document.getElementById('dataRetirada').value = retirada ? formatarData(retirada) : '';
}

// Extrai campos com regex
function extrairTexto(texto, regex) {
    const match = texto.match(regex);
    return match ? match[1].trim() : '';
}

// Extrai apenas Descrição + Quantidade
function extrairProdutos(texto) {
    const linhas = texto.split('\n');
    const produtos = [];

    for (let linha of linhas) {
        const textoLimpo = linha.toLowerCase();
        if (
            textoLimpo.includes('código') ||
            textoLimpo.includes('referência') ||
            textoLimpo.includes('descrição') ||
            textoLimpo.includes('quantidade') ||
            textoLimpo.includes('preço')
        ) continue;

        const match = linha.match(/\d{2,5}\s+\d{9,12}\s+(.+?)\s+(\d+)\s+UND/i);
        if (match) {
            const descricao = match[1].replace(/\s+/g, ' ').trim();
            const quantidade = match[2].trim();
            produtos.push(`${descricao} - ${quantidade} un`);
        }
    }

    return produtos.length ? produtos.join('\n') : '';
}

// Extrai as observações completas
function extrairObservacoes(texto) {
    const match = texto.match(
        /Observa[çc][õo]es\s*[:\-]?\s*((?:.|\n)*?)(?=\n\s*(Código|Refer[eê]ncia|Descrição|Quantidade|Preço|Retirada))/i
    );

    if (match) {
        let observacoes = match[1];

        // Remove qualquer trecho como "Retirada: dd/mm/yyyy" que esteja dentro da observação
        observacoes = observacoes.replace(/Retirada:\s*\d{2}\/\d{2}\/\d{4}/i, '');

        // Normaliza espaços
        return observacoes.replace(/\s+/g, ' ').trim();
    }

    return '';
}
async function carregarEtiquetas() {
    const url = `https://api.trello.com/1/boards/${trelloBoardId}/labels?key=${trelloKey}&token=${trelloToken}`;

    try {
        const resposta = await fetch(url);
        const etiquetas = await resposta.json();

        const selectEtiquetas = document.getElementById('etiquetasTrello');
        selectEtiquetas.innerHTML = '<option value="">Selecione etiquetas</option>';
        selectEtiquetas.multiple = true;

        etiquetas.forEach(label => {
            const option = document.createElement('option');
            option.value = label.id;
            option.textContent = label.name || label.color; // caso não tenha nome
            selectEtiquetas.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar etiquetas:', error);
        alert('Erro ao carregar etiquetas do Trello.');
    }
}



// Formata data para yyyy-mm-dd
function formatarData(dataBR) {
    const [dia, mes, ano] = dataBR.split('/');
    // Retorna no formato esperado pelo input datetime-local
    return `${ano}-${mes}-${dia}T18:00`;
}

let dueISO = null;
if (dataRetirada) {
  const dt = new Date(dataRetirada);
  if (dt.getHours() === 0 && dt.getMinutes() === 0) {
    dt.setHours(18, 0, 0);
  }
  dueISO = dt.toISOString();
}

const dadosCartao = {
    idList: idLista,
    name: nomeCartao,
    desc: descricao,
    due: dueISO,
    idMembers: membrosSelecionados.join(',') || null
  };
  

// Mensagens
function mostrarMensagem(msg, erro = false) {
    const div = document.getElementById('mensagem');
    div.style.color = erro ? 'red' : 'green';
    div.textContent = msg;
}
async function adicionarPedido() {
    const nomeCartao = document.getElementById('nomeCartao').value.trim();
    const descricao = document.getElementById('descricaoCartao').value.trim();
    const idLista = document.getElementById('listaTrello').value;
    const dataRetirada = document.getElementById('dataRetirada').value;
    const membrosSelecionados = Array.from(document.getElementById('membroTrello').selectedOptions).map(opt => opt.value);
    const arquivos = document.getElementById('anexos').files;

    if (!nomeCartao || !descricao || !idLista) {
        alert("Preencha ao menos: Lista, Nome do Cartão e Descrição.");
        return;
    }

    try {
        // Define a data de entrega (due) com hora 18h se não for informada
        let dueISO = null;
        if (dataRetirada) {
            const dt = new Date(dataRetirada);
            if (dt.getHours() === 0 && dt.getMinutes() === 0) {
                dt.setHours(18, 0, 0);
            }
            dueISO = dt.toISOString();
        }

        const urlCartao = `https://api.trello.com/1/cards?key=${trelloKey}&token=${trelloToken}`;
        const dadosCartao = {
            idList: idLista,
            name: nomeCartao,
            desc: descricao,
            due: dueISO,
            idMembers: membrosSelecionados.join(',') || null
        };

        const resposta = await fetch(urlCartao, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosCartao)
        });

        if (!resposta.ok) throw new Error('Erro ao criar cartão.');

        const cartaoCriado = await resposta.json();

        // 2. Anexar arquivos (se houver)
if (arquivos.length > 0) {
    for (let i = 0; i < arquivos.length; i++) {
        const formData = new FormData();
        formData.append('file', arquivos[i], arquivos[i].name); // nome incluso
        formData.append('name', arquivos[i].name); // nome legível no Trello
        formData.append('key', trelloKey);
        formData.append('token', trelloToken);

        try {
            const resAnexo = await fetch(`https://api.trello.com/1/cards/${cartaoCriado.id}/attachments`, {
                method: 'POST',
                body: formData
            });

            if (!resAnexo.ok) {
                const texto = await resAnexo.text();
                console.error(`❌ Falha ao anexar ${arquivos[i].name}:`, texto);
            } else {
                console.log(`📎 Anexo enviado: ${arquivos[i].name}`);
            }
        } catch (e) {
            console.error(`❌ Erro ao tentar anexar ${arquivos[i].name}:`, e);
        }
    }
} else {
    console.log("Nenhum arquivo selecionado para anexo.");
}

        

        mostrarMensagem("✅ Pedido adicionado com sucesso!");
        limparFormulario();
        document.getElementById('debugPdf').style.display = 'none';
        document.getElementById('debugPdf').textContent = '';
        document.getElementById('pdfInput').value = '';
    } catch (error) {
        console.error(error);
        mostrarMensagem("❌ Erro ao adicionar o pedido.", true);
    }
}


function limparFormulario() {
    document.getElementById('nomeCartao').value = '';
    document.getElementById('descricaoCartao').value = '';
    document.getElementById('dataRetirada').value = '';
    document.getElementById('anexos').value = '';
    document.getElementById('membroTrello').selectedIndex = -1;
    document.getElementById('listaTrello').selectedIndex = 0;
}
