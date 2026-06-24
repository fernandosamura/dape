import { WASocket } from "baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { isNumeric, sleep, validaCpfCnpj, sendMessageImage, sendMessageLink } from "../WbotServices/wbotMessageListener";
import formatBody from "../../helpers/Mustache";
import axios from "axios";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import puppeteer from "puppeteer";
import fs from "fs";

export interface MkAuthSettings {
  urlmkauth: string;
  url: string;
  clientId: string;
  clientSecret: string;
}

export const handleMkAuthBoleto = async (
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  cpfcnpj: string,
  settings: MkAuthSettings
): Promise<void> => {
  const { urlmkauth, url, clientId: Client_Id, clientSecret: Client_Secret } = settings;
  let numberCPFCNPJ = cpfcnpj;

  if (urlmkauth != "" && Client_Id != "" && Client_Secret != "") {
    if (isNumeric(numberCPFCNPJ) === true) {
      if (cpfcnpj.length > 2) {
        const isCPFCNPJ = validaCpfCnpj(numberCPFCNPJ)
        if (isCPFCNPJ) {
          const textMessage = {
            text: formatBody(`Aguarde! Estamos consultando na base de dados!`, contact),
          };
          try {
            await sleep(2000)
            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, textMessage);
          } catch (error) {

          }


          axios({
            rejectUnauthorized: true,
            method: 'get',
            url,
            auth: {
              username: Client_Id,
              password: Client_Secret
            }
          } as any)
            .then(function (response) {
              const jtw = response.data
              var config = {
                method: 'GET',
                url: `${urlmkauth}/api/cliente/show/${numberCPFCNPJ}`,
                headers: {
                  Authorization: `Bearer ${jtw}`
                }
              };
              axios.request(config as any)
                .then(async function (response) {
                  if (response.data == 'NULL') {
                    const textMessage = {
                      text: formatBody(`Cadastro não localizado! *CPF/CNPJ* incorreto ou inválido. Tenta novamente!`, contact),
                    };
                    try {
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, textMessage);
                    } catch (error) {
                      console.log('Não consegui enviar a mensagem!')
                    }
                  } else {
                    let nome
                    let cpf_cnpj
                    let qrcode
                    let valor
                    let bloqueado
                    let linhadig
                    let uuid_cliente
                    let referencia
                    let status
                    let datavenc
                    let descricao
                    let titulo
                    let statusCorrigido
                    let valorCorrigido

                    nome = response.data.dados_cliente.titulos.nome
                    cpf_cnpj = response.data.dados_cliente.titulos.cpf_cnpj
                    valor = response.data.dados_cliente.titulos.valor
                    bloqueado = response.data.dados_cliente.titulos.bloqueado
                    uuid_cliente = response.data.dados_cliente.titulos.uuid_cliente
                    qrcode = response.data.dados_cliente.titulos.qrcode
                    linhadig = response.data.dados_cliente.titulos.linhadig
                    referencia = response.data.dados_cliente.titulos.referencia
                    status = response.data.dados_cliente.titulos.status
                    datavenc = response.data.dados_cliente.titulos.datavenc
                    descricao = response.data.dados_cliente.titulos.descricao
                    titulo = response.data.dados_cliente.titulos.titulo
                    statusCorrigido = status[0].toUpperCase() + status.substr(1);
                    valorCorrigido = valor.replace(".", ",");

                    var curdate = new Date(datavenc)
                    const mesCorreto = curdate.getMonth() + 1
                    const ano = ('0' + curdate.getFullYear()).slice(-4)
                    const mes = ('0' + mesCorreto).slice(-2)
                    const dia = ('0' + curdate.getDate()).slice(-2)
                    const anoMesDia = `${dia}/${mes}/${ano}`

                    try {
                      const textMessage = { text: formatBody(`Localizei seu Cadastro! *${nome}* só mais um instante por favor!`, contact) };
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, textMessage);
                      const bodyBoleto = { text: formatBody(`Segue a segunda-via da sua Fatura!\n\n*Nome:* ${nome}\n*Valor:* R$ ${valorCorrigido}\n*Data Vencimento:* ${anoMesDia}\n*Link:* ${urlmkauth}/boleto/21boleto.php?titulo=${titulo}\n\nVou mandar o *código de barras* na próxima mensagem para ficar mais fácil para você copiar!`, contact) };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBoleto);
                      const bodyLinha = { text: formatBody(`${linhadig}`, contact) };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyLinha);
                      if (qrcode !== null) {
                        const bodyPdf = { text: formatBody(`Este é o *PIX COPIA E COLA*`, contact) };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                        const bodyqrcode = { text: formatBody(`${qrcode}`, contact) };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                        let linkBoleto = `https://chart.googleapis.com/chart?cht=qr&chs=500x500&chld=L|0&chl=${qrcode}`
                        await sleep(2000)
                        await sendMessageImage(wbot, contact, ticket, linkBoleto, "")
                      }
                      const bodyPdf = { text: formatBody(`Agora vou te enviar o boleto em *PDF* caso você precise.`, contact) };
                      await sleep(2000)
                      const bodyPdfQr = { text: formatBody(`${bodyPdf}`, contact) };
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdfQr);
                      await sleep(2000)

                      //GERA O PDF
                      const nomePDF = `Boleto-${nome}-${dia}-${mes}-${ano}.pdf`;
                      (async () => {
                        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                        const page = await browser.newPage();
                        const website_url = `${urlmkauth}/boleto/21boleto.php?titulo=${titulo}`;
                        await page.goto(website_url, { waitUntil: 'networkidle0' });
                        await page.emulateMediaType('screen');
                        // Downlaod the PDF
                        const pdf = await page.pdf({
                          path: nomePDF,
                          printBackground: true,
                          format: 'A4',
                        });

                        await browser.close();
                        await sendMessageLink(wbot, contact, ticket, nomePDF, nomePDF);
                      });


                      if (bloqueado === 'sim') {
                        const bodyBloqueio = { text: formatBody(`${nome} vi tambem que a sua conexão esta bloqueada! Vou desbloquear para você por *48 horas*.`, contact) };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBloqueio);
                        const bodyqrcode = { text: formatBody(`Estou liberando seu acesso. Por favor aguarde!`, contact) };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                        var optionsdesbloq = {
                          method: 'GET',
                          url: `${urlmkauth}/api/cliente/desbloqueio/${uuid_cliente}`,
                          headers: {
                            Authorization: `Bearer ${jtw}`
                          }
                        };
                        axios.request(optionsdesbloq as any).then(async function (response) {
                          const bodyLiberado = { text: formatBody(`Pronto liberei! Vou precisar que você *retire* seu equipamento da tomada.\n\n*OBS: Somente retire da tomada.* \nAguarde 1 minuto e ligue novamente!`, contact) };
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyLiberado);
                          const bodyqrcode = { text: formatBody(`Veja se seu acesso voltou! Caso nao tenha voltado retorne o contato e fale com um atendente!`, contact) };
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                        }).catch(async function (error) {
                          const bodyfinaliza = { text: formatBody(`Opss! Algo de errado aconteceu! Digite *#* para voltar ao menu anterior e fale com um atendente!`, contact) };
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                        });
                      }


                      const bodyfinaliza = { text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact) };
                      await sleep(12000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);

                      await sleep(2000)
                      fs.unlink(nomePDF, function (err) {
                        if (err) throw err;
                        console.log(err);
                      })

                      await UpdateTicketService({
                        ticketData: { status: "closed" },
                        ticketId: ticket.id,
                        companyId: ticket.companyId,
                      });

                    } catch (error) {
                      console.log('11 Não consegui enviar a mensagem!')
                    }
                  }
                })
                .catch(async function (error) {
                  try {
                    const bodyBoleto = { text: formatBody(`Não consegui encontrar seu cadastro.\n\nPor favor tente novamente!\nOu digite *#* para voltar ao *Menu Anterior*`, contact) };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBoleto);
                  } catch (error) {
                    console.log('111 Não consegui enviar a mensagem!')
                  }

                });
            })
            .catch(async function (error) {
              const bodyfinaliza = { text: formatBody(`Opss! Algo de errado aconteceu! Digite *#* para voltar ao menu anterior e fale com um atendente!`, contact) };
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
            });
        } else {
          const body = { text: formatBody(`Este CPF/CNPJ não é válido!\n\nPor favor tente novamente!\nOu digite *#* para voltar ao *Menu Anterior*`, contact) };
          await sleep(2000)
          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
        }
      }
    }
  }
};
