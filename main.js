const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const folderPath = './iptus'; // Pasta com os arquivos de IPTU

// Função para extrair texto do PDF
async function extractTextFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

// Função para extrair o bairro do campo de endereço, removendo quebras de linha e espaços extras
function extractBairro(text) {
    if (!text) return null;

    // 1. Tenta encontrar o bairro logo após "ENDEREÇO IMÓVEL"
    let match = text.match(/ENDEREÇO IMÓVEL\s*[^\n]*\s*-\s*([A-Z\s]+)/);
    if (match) return match[1].trim().replace(/\s+/g, ' ');

    // 2. Se não encontrou, tenta extrair após a rua e número
    match = text.match(/RUA\s+[A-Z\s]+\d+\s+-\s+([A-Z\s]+)/);
    return match ? match[1].trim().replace(/\s+/g, ' ') : null;
}

// Função para extrair lote e quadra do campo de inscrição no formato XXXXX.XX.QUADRA.LOTE.XXX
function extractLoteQuadra(inscricao) {
    if (!inscricao) return { lote: null, quadra: null };

    const match = inscricao.match(/\d{5}\.\d{2}\.(\d{3})\.(\d{4})\.\d{3}/);
    if (match) {
        return { quadra: match[1], lote: match[2] };
    }
    return { lote: null, quadra: null };
}

// Função para extrair campos específicos do texto do PDF
function extractFields(text) {
    const fields = {};

    // Expressões regulares para localizar os valores desejados
    const enderecoRegex = /ENDEREÇO IMÓVEL\n([a-zA-Z0-9\s,]+)/;
    const inscricaoRegex = /INSCRIÇÃO IMOBILIÁRIA\n([^\n]+)/;

    // Extraindo endereço e inscrição
    const enderecoMatch = text.match(enderecoRegex);
    const inscricaoMatch = text.match(inscricaoRegex);

    console.log("Texto extraído do PDF:\n", text);
    console.log("Endereço encontrado:", enderecoMatch ? enderecoMatch[1].trim() : "Não encontrado");
    console.log("Inscrição encontrada:", inscricaoMatch ? inscricaoMatch[1].trim() : "Não encontrado");

    fields.endereco = enderecoMatch ? enderecoMatch[1].trim() : null;
    fields.inscricao = inscricaoMatch ? inscricaoMatch[1].trim() : null;

    return fields;
}

// Função para renomear arquivos com um atraso para liberar recursos
async function renameFiles() {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);

        if (path.extname(file) === '.pdf') { // Apenas para arquivos PDF
            const text = await extractTextFromPDF(filePath);
            const extractedFields = extractFields(text);

            if (extractedFields.inscricao) {
                // Extrai o bairro usando o texto completo, para considerar ambos os casos
                const bairro = extractBairro(text);
                const { lote, quadra } = extractLoteQuadra(extractedFields.inscricao);

                if (bairro && lote && quadra) {
                    const newFileName = `${bairro} Q ${quadra} L ${lote}.pdf`;
                    const newFilePath = path.join(folderPath, newFileName);

                    // Adiciona um tempo de espera antes de renomear
                    await new Promise(resolve => setTimeout(resolve, 1));

                    try {
                        fs.renameSync(filePath, newFilePath);
                        console.log(`Arquivo renomeado para: ${newFileName}`);
                    } catch (error) {
                        console.error(`Erro ao renomear o arquivo ${file}:`, error);
                    }
                } else {
                    console.error(`Erro: Não foi possível extrair todos os campos para renomear o arquivo: ${file}`);
                    console.log(`Bairro extraído: ${bairro}`);
                    console.log(`Lote extraído: ${lote}`);
                    console.log(`Quadra extraída: ${quadra}`);
                }
            } else {
                console.error(`Erro: Endereço ou inscrição não encontrados no arquivo: ${file}`);
            }
        }
    }
}

// Executa a função
renameFiles()
    .then(() => console.log('Renomeação concluída!'))
    .catch(err => console.error('Erro ao renomear arquivos:', err));
