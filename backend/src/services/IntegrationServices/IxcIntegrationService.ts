import { proto, WASocket } from "baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { isNumeric, sleep, validaCpfCnpj, sendMessageImage } from "../WbotServices/wbotMessageListener";
import formatBody from "../../helpers/Mustache";
import axios from "axios";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { dapleShield } from "../../dape/shield/dapleShield.service";
import { logger } from "../../utils/logger";

export interface IxcSettings {
  urlixc: string;
  ixckeybase64: string;
}

export const handleIxcBoleto = async (
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  cpfcnpj: string,
  settings: IxcSettings
): Promise<void> => {
  const { urlixc, ixckeybase64 } = settings;
  if (!urlixc || !ixckeybase64) return;

  // DAPLE Shield — blocking check before any integration sends
  const shieldResult = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "integration",
    ticketId: ticket.id,
    contactNumber: ticket.contact?.number
  });
  if (!shieldResult.allowed) {
    logger.warn(`[DapleShield] Envio bloqueado (ixc boleto integration): ${shieldResult.reason}`);
    return;
  }

  let numberCPFCNPJ = cpfcnpj;

  if (isNumeric(numberCPFCNPJ) === true) {
    if (cpfcnpj.length > 2) {
      const isCPFCNPJ = validaCpfCnpj(numberCPFCNPJ)
      if (isCPFCNPJ) {
        if (numberCPFCNPJ.length <= 11) {
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d)/, "$1.$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d)/, "$1.$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        } else {
          numberCPFCNPJ = numberCPFCNPJ.replace(/^(\d{2})(\d)/, "$1.$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
          numberCPFCNPJ = numberCPFCNPJ.replace(/\.(\d{3})(\d)/, ".$1/$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{4})(\d)/, "$1-$2")
        }
        const body = {
          text: formatBody(`Aguarde! Estamos consultando na base de dados!`, contact),
        };
        try {
          await sleep(2000)
          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
        } catch (error) {
        }
        var options = {
          method: 'GET',
          url: `${urlixc}/webservice/v1/cliente`,
          headers: {
            ixcsoft: 'listar',
            Authorization: `Basic ${ixckeybase64}`
          },
          data: {
            qtype: 'cliente.cnpj_cpf',
            query: numberCPFCNPJ,
            oper: '=',
            page: '1',
            rp: '1',
            sortname: 'cliente.cnpj_cpf',
            sortorder: 'asc'
          }
        };

        axios.request(options as any).then(async function (response) {
          if (response.data.type === 'error') {
            console.log("Error response", response.data.message);
            const body = {
              text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
            };
            await sleep(2000)
            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
          } if (response.data.total === 0) {
            const body = {
              text: formatBody(`Cadastro não localizado! *CPF/CNPJ* incorreto ou inválido. Tenta novamente!`, contact),
            };
            try {
              await sleep(2000)
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
            } catch (error) {
            }
          } else {
            let nome;
            let id;
            let type;
            nome = response.data?.registros[0]?.razao
            id = response.data?.registros[0]?.id
            type = response.data?.type

            const body = {
              text: formatBody(`Localizei seu Cadastro! \n*${nome}* só mais um instante por favor!`, contact),
            };
            await sleep(2000)
            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
            var boleto = {
              method: 'GET',
              url: `${urlixc}/webservice/v1/fn_areceber`,
              headers: {
                ixcsoft: 'listar',
                Authorization: `Basic ${ixckeybase64}`
              },
              data: {
                qtype: 'fn_areceber.id_cliente',
                query: id,
                oper: '=',
                page: '1',
                rp: '1',
                sortname: 'fn_areceber.data_vencimento',
                sortorder: 'asc',
                grid_param: '[{"TB":"fn_areceber.status", "OP" : "=", "P" : "A"}]'
              }
            };
            axios.request(boleto as any).then(async function (response) {
              let gateway_link;
              let valor;
              let datavenc;
              let datavencCorrigida;
              let valorCorrigido;
              let linha_digitavel;
              let impresso;
              let idboleto;

              idboleto = response.data?.registros[0]?.id
              gateway_link = response.data?.registros[0]?.gateway_link
              valor = response.data?.registros[0]?.valor
              datavenc = response.data?.registros[0]?.data_vencimento
              linha_digitavel = response.data?.registros[0]?.linha_digitavel
              impresso = response.data?.registros[0]?.impresso
              valorCorrigido = valor.replace(".", ",");
              datavencCorrigida = datavenc.split('-').reverse().join('/')

              if (impresso !== "S") {
                var boletopdf = {
                  method: 'GET',
                  url: `${urlixc}/webservice/v1/get_boleto`,
                  headers: {
                    ixcsoft: 'listar',
                    Authorization: `Basic ${ixckeybase64}`
                  },
                  data: {
                    boletos: idboleto,
                    juro: 'N',
                    multa: 'N',
                    atualiza_boleto: 'N',
                    tipo_boleto: 'arquivo',
                    base64: 'S'
                  }
                };
                axios.request(boletopdf as any).then(function (response) {
                }).catch(function (error) {
                  console.error(error);
                });
              }

              var optionsPix = {
                method: 'GET',
                url: `${urlixc}/webservice/v1/get_pix`,
                headers: {
                  ixcsoft: 'listar',
                  Authorization: `Basic ${ixckeybase64}`
                },
                data: { id_areceber: idboleto }
              };

              axios.request(optionsPix as any).then(async function (response) {
                let tipo;
                let pix;
                tipo = response.data?.type;
                pix = response.data?.pix?.qrCode?.qrcode;
                if (tipo === 'success') {
                  const bodyBoletoPix = {
                    text: formatBody(`Segue a segunda-via da sua Fatura!\n\n*Fatura:* ${idboleto}\n*Nome:* ${nome}\n*Valor:* R$ ${valorCorrigido}\n*Data Vencimento:* ${datavencCorrigida}\n\nVou te enviar o *Código de Barras* e o *PIX* basta clicar em qual você quer utlizar que já vai copiar! Depois basta realizar o pagamento no seu banco`, contact),
                  };
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBoletoPix);
                  const body_linhadigitavel = {
                    text: formatBody("Este é o *Código de Barras*", contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_linhadigitavel);
                  await sleep(2000)
                  const body_linha_digitavel = {
                    text: formatBody(`${linha_digitavel}`, contact),
                  };
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_linha_digitavel);
                  const body_pix = {
                    text: formatBody("Este é o *PIX Copia e Cola*", contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_pix);
                  await sleep(2000)
                  const body_pix_dig = {
                    text: formatBody(`${pix}`, contact),
                  };
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_pix_dig);
                  const body_pixqr = {
                    text: formatBody("QR CODE do *PIX*", contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_pixqr);
                  let linkBoleto = `https://chart.googleapis.com/chart?cht=qr&chs=500x500&chld=L|0&chl=${pix}`
                  await sleep(2000)
                  await sendMessageImage(wbot, contact, ticket, linkBoleto, '')

                  var optionscontrato = {
                    method: 'POST',
                    url: `${urlixc}/webservice/v1/cliente_contrato`,
                    headers: {
                      ixcsoft: 'listar',
                      Authorization: `Basic ${ixckeybase64}`
                    },
                    data: {
                      qtype: 'cliente_contrato.id_cliente',
                      query: id,
                      oper: '=',
                      page: '1',
                      rp: '1',
                      sortname: 'cliente_contrato.id',
                      sortorder: 'asc'
                    }
                  };
                  axios.request(optionscontrato as any).then(async function (response) {
                    let status_internet;
                    let id_contrato;
                    status_internet = response.data?.registros[0]?.status_internet;
                    id_contrato = response.data?.registros[0]?.id;
                    if (status_internet !== 'A') {
                      const bodyPdf = {
                        text: formatBody(`*${nome}* vi tambem que a sua conexão esta bloqueada! Vou desbloquear para você.`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                      const bodyqrcode = {
                        text: formatBody(`Estou liberando seu acesso. Por favor aguarde!`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                      var optionsdesbloqeuio = {
                        method: 'POST',
                        url: `${urlixc}/webservice/v1/desbloqueio_confianca`,
                        headers: {
                          Authorization: `Basic ${ixckeybase64}`
                        },
                        data: { id: id_contrato }
                      };
                      axios.request(optionsdesbloqeuio as any).then(async function (response) {
                        let tipo;
                        let mensagem;
                        tipo = response.data?.tipo;
                        mensagem = response.data?.mensagem;
                        if (tipo === 'sucesso') {
                          var optionsRadius = {
                            method: 'GET',
                            url: `${urlixc}/webservice/v1/radusuarios`,
                            headers: {
                              ixcsoft: 'listar',
                              Authorization: `Basic ${ixckeybase64}`
                            },
                            data: {
                              qtype: 'radusuarios.id_cliente',
                              query: id,
                              oper: '=',
                              page: '1',
                              rp: '1',
                              sortname: 'radusuarios.id',
                              sortorder: 'asc'
                            }
                          };
                          axios.request(optionsRadius as any).then(async function (response) {
                            let tipo;
                            tipo = response.data?.type;
                            if (tipo === 'success') {
                              const body_mensagem = {
                                text: formatBody(`${mensagem}`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_mensagem);
                              const bodyPdf = {
                                text: formatBody(`Fiz os procedimentos de liberação! Agora aguarde até 5 minutos e veja se sua conexão irá retornar!\n\nCaso não tenha voltado, retorne o contato e fale com um atendente!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                              const bodyfinaliza = {
                                text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                              await UpdateTicketService({
                                ticketData: { status: "closed" },
                                ticketId: ticket.id,
                                companyId: ticket.companyId,
                              });
                            }
                          }).catch(function (error) {
                            console.error(error);
                          });
                        } else {
                          var msgerrolbieracao = response.data.mensagem
                          const bodyerro = {
                            text: formatBody(`Ops! Ocorreu um erro e nao consegui desbloquear`, contact),
                          };
                          const msg_errolbieracao = {
                            text: formatBody(`${msgerrolbieracao}`, contact),
                          };
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, msg_errolbieracao);
                          const bodyerroatendent = {
                            text: formatBody(`Digite *#* para voltar o menu e fale com um atendente!`, contact),
                          };
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerroatendent);
                        }
                      }).catch(async function (error) {
                        const bodyerro = {
                          text: formatBody(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                      });
                    } else {
                      const bodyfinaliza = {
                        text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                      };
                      await sleep(8000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                      await UpdateTicketService({
                        ticketData: { status: "closed" },
                        ticketId: ticket.id,
                        companyId: ticket.companyId,
                      });
                    }
                  }).catch(async function (error) {
                    const bodyerro = {
                      text: formatBody(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`, contact),
                    };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                  });
                } else {
                  const bodyBoleto = {
                    text: formatBody(`Segue a segunda-via da sua Fatura!\n\n*Fatura:* ${idboleto}\n*Nome:* ${nome}\n*Valor:* R$ ${valorCorrigido}\n*Data Vencimento:* ${datavencCorrigida}\n\nBasta clicar aqui em baixo em código de barras para copiar, apos isto basta realizar o pagamento em seu banco!`, contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBoleto);
                  const body = {
                    text: formatBody(`Este é o *Codigo de Barras*`, contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
                  await sleep(2000)
                  const body_linha_digitavel = {
                    text: formatBody(`${linha_digitavel}`, contact),
                  };
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_linha_digitavel);
                  var optionscontrato = {
                    method: 'POST',
                    url: `${urlixc}/webservice/v1/cliente_contrato`,
                    headers: {
                      ixcsoft: 'listar',
                      Authorization: `Basic ${ixckeybase64}`
                    },
                    data: {
                      qtype: 'cliente_contrato.id_cliente',
                      query: id,
                      oper: '=',
                      page: '1',
                      rp: '1',
                      sortname: 'cliente_contrato.id',
                      sortorder: 'asc'
                    }
                  };
                  axios.request(optionscontrato as any).then(async function (response) {
                    let status_internet;
                    let id_contrato;
                    status_internet = response.data?.registros[0]?.status_internet;
                    id_contrato = response.data?.registros[0]?.id;
                    if (status_internet !== 'A') {
                      const bodyPdf = {
                        text: formatBody(`*${nome}* vi tambem que a sua conexão esta bloqueada! Vou desbloquear para você.`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                      const bodyqrcode = {
                        text: formatBody(`Estou liberando seu acesso. Por favor aguarde!`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                      var optionsdesbloqeuio = {
                        method: 'POST',
                        url: `${urlixc}/webservice/v1/desbloqueio_confianca`,
                        headers: {
                          Authorization: `Basic ${ixckeybase64}`
                        },
                        data: { id: id_contrato }
                      };
                      axios.request(optionsdesbloqeuio as any).then(async function (response) {
                        let tipo;
                        let mensagem;
                        tipo = response.data?.tipo;
                        mensagem = response.data?.mensagem;
                        if (tipo === 'sucesso') {
                          var optionsRadius = {
                            method: 'GET',
                            url: `${urlixc}/webservice/v1/radusuarios`,
                            headers: {
                              ixcsoft: 'listar',
                              Authorization: `Basic ${ixckeybase64}`
                            },
                            data: {
                              qtype: 'radusuarios.id_cliente',
                              query: id,
                              oper: '=',
                              page: '1',
                              rp: '1',
                              sortname: 'radusuarios.id',
                              sortorder: 'asc'
                            }
                          };
                          axios.request(optionsRadius as any).then(async function (response) {
                            let tipo;
                            tipo = response.data?.type;
                            const body_mensagem = {
                              text: formatBody(`${mensagem}`, contact),
                            };
                            if (tipo === 'success') {
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_mensagem);
                              const bodyPdf = {
                                text: formatBody(`Fiz os procedimentos de liberação! Agora aguarde até 5 minutos e veja se sua conexão irá retornar!\n\nCaso não tenha voltado, retorne o contato e fale com um atendente!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                              const bodyfinaliza = {
                                text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                              await UpdateTicketService({
                                ticketData: { status: "closed" },
                                ticketId: ticket.id,
                                companyId: ticket.companyId,
                              });
                            } else {
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_mensagem);
                              const bodyPdf = {
                                text: formatBody(`Vou precisar que você *retire* seu equipamento da tomada.\n\n*OBS: Somente retire da tomada.* \nAguarde 1 minuto e ligue novamente!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                              const bodyqrcode = {
                                text: formatBody(`Veja se seu acesso voltou! Caso não tenha voltado retorne o contato e fale com um atendente!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                              const bodyfinaliza = {
                                text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                              };
                              await sleep(2000)
                              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                              await UpdateTicketService({
                                ticketData: { status: "closed" },
                                ticketId: ticket.id,
                                companyId: ticket.companyId,
                              });
                            }
                          }).catch(function (error) {
                            console.error(error);
                          });
                        } else {
                          const bodyerro = {
                            text: formatBody(`Ops! Ocorreu um erro e nao consegui desbloquear! Digite *#* e fale com um atendente!`, contact),
                          };
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                        }
                      }).catch(async function (error) {
                        const bodyerro = {
                          text: formatBody(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                      });
                    } else {
                      const bodyfinaliza = {
                        text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                      await UpdateTicketService({
                        ticketData: { status: "closed" },
                        ticketId: ticket.id,
                        companyId: ticket.companyId,
                      });
                    }
                  }).catch(async function (error) {
                    const bodyerro = {
                      text: formatBody(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`, contact),
                    };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                  });
                }
              }).catch(function (error) {
                console.error(error);
              });
            }).catch(async function (error) {
              const body = {
                text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
              };
              await sleep(2000)
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
            });
          }
        }).catch(async function (error) {
          const body = {
            text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
          };
          await sleep(2000)
          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
        });
      } else {
        const body = {
          text: formatBody(`Este CPF/CNPJ não é válido!\n\nPor favor tente novamente!\nOu digite *#* para voltar ao *Menu Anterior*`, contact),
        };
        await sleep(2000)
        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
      }
    }
  }
};

export const handleIxcReligue = async (
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  cpfcnpj: string,
  settings: IxcSettings
): Promise<void> => {
  const { urlixc, ixckeybase64 } = settings;
  if (!urlixc || !ixckeybase64) return;

  // DAPLE Shield — blocking check before any integration sends
  const shieldResultReligue = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "integration",
    ticketId: ticket.id,
    contactNumber: ticket.contact?.number
  });
  if (!shieldResultReligue.allowed) {
    logger.warn(`[DapleShield] Envio bloqueado (ixc religue integration): ${shieldResultReligue.reason}`);
    return;
  }

  let numberCPFCNPJ = cpfcnpj;

  if (isNumeric(numberCPFCNPJ) === true) {
    if (cpfcnpj.length > 2) {
      const isCPFCNPJ = validaCpfCnpj(numberCPFCNPJ)
      if (isCPFCNPJ) {
        if (numberCPFCNPJ.length <= 11) {
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d)/, "$1.$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d)/, "$1.$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        } else {
          numberCPFCNPJ = numberCPFCNPJ.replace(/^(\d{2})(\d)/, "$1.$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
          numberCPFCNPJ = numberCPFCNPJ.replace(/\.(\d{3})(\d)/, ".$1/$2")
          numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{4})(\d)/, "$1-$2")
        }
        const body = {
          text: formatBody(`Aguarde! Estamos consultando na base de dados!`, contact),
        };
        try {
          await sleep(2000)
          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
        } catch (error) {}

        var options = {
          method: 'GET',
          url: `${urlixc}/webservice/v1/cliente`,
          headers: {
            ixcsoft: 'listar',
            Authorization: `Basic ${ixckeybase64}`
          },
          data: {
            qtype: 'cliente.cnpj_cpf',
            query: numberCPFCNPJ,
            oper: '=',
            page: '1',
            rp: '1',
            sortname: 'cliente.cnpj_cpf',
            sortorder: 'asc'
          }
        };

        axios.request(options as any).then(async function (response) {
          if (response.data.type === 'error') {
            const body = {
              text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
            };
            await sleep(2000)
            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
          } if (response.data.total === 0) {
            const body = {
              text: formatBody(`Cadastro não localizado! *CPF/CNPJ* incorreto ou inválido. Tenta novamente!`, contact),
            };
            try {
              await sleep(2000)
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
            } catch (error) {}
          } else {
            let nome;
            let id;
            nome = response.data?.registros[0]?.razao
            id = response.data?.registros[0]?.id

            const body = {
              text: formatBody(`Localizei seu Cadastro! \n*${nome}* só mais um instante por favor!`, contact),
            };
            await sleep(2000)
            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);

            var optionscontrato = {
              method: 'POST',
              url: `${urlixc}/webservice/v1/cliente_contrato`,
              headers: {
                ixcsoft: 'listar',
                Authorization: `Basic ${ixckeybase64}`
              },
              data: {
                qtype: 'cliente_contrato.id_cliente',
                query: id,
                oper: '=',
                page: '1',
                rp: '1',
                sortname: 'cliente_contrato.id',
                sortorder: 'asc'
              }
            };
            axios.request(optionscontrato as any).then(async function (response) {
              let status_internet;
              let id_contrato;
              status_internet = response.data?.registros[0]?.status_internet;
              id_contrato = response.data?.registros[0]?.id;
              if (status_internet !== 'A') {
                const bodyPdf = {
                  text: formatBody(`*${nome}*  a sua conexão esta bloqueada! Vou desbloquear para você.`, contact),
                };
                await sleep(2000)
                await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                const bodyqrcode = {
                  text: formatBody(`Estou liberando seu acesso. Por favor aguarde!`, contact),
                };
                await sleep(2000)
                await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                var optionsdesbloqeuio = {
                  method: 'POST',
                  url: `${urlixc}/webservice/v1/desbloqueio_confianca`,
                  headers: {
                    Authorization: `Basic ${ixckeybase64}`
                  },
                  data: { id: id_contrato }
                };
                axios.request(optionsdesbloqeuio as any).then(async function (response) {
                  let tipo;
                  let mensagem;
                  tipo = response.data?.tipo;
                  mensagem = response.data?.mensagem;
                  const body_mensagem = {
                    text: formatBody(`${mensagem}`, contact),
                  };
                  if (tipo === 'sucesso') {
                    var optionsRadius = {
                      method: 'GET',
                      url: `${urlixc}/webservice/v1/radusuarios`,
                      headers: {
                        ixcsoft: 'listar',
                        Authorization: `Basic ${ixckeybase64}`
                      },
                      data: {
                        qtype: 'radusuarios.id_cliente',
                        query: id,
                        oper: '=',
                        page: '1',
                        rp: '1',
                        sortname: 'radusuarios.id',
                        sortorder: 'asc'
                      }
                    };
                    axios.request(optionsRadius as any).then(async function (response) {
                      let tipo;
                      tipo = response.data?.type;
                      if (tipo === 'success') {
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_mensagem);
                        const bodyPdf = {
                          text: formatBody(`Fiz os procedimentos de liberação! Agora aguarde até 5 minutos e veja se sua conexão irá retornar!\n\nCaso não tenha voltado, retorne o contato e fale com um atendente!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                        const bodyfinaliza = {
                          text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                        await UpdateTicketService({
                          ticketData: { status: "closed" },
                          ticketId: ticket.id,
                          companyId: ticket.companyId,
                        });
                      } else {
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_mensagem);
                        const bodyPdf = {
                          text: formatBody(`Vou precisar que você *retire* seu equipamento da tomada.\n\n*OBS: Somente retire da tomada.* \nAguarde 1 minuto e ligue novamente!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPdf);
                        const bodyqrcode = {
                          text: formatBody(`Veja se seu acesso voltou! Caso não tenha voltado retorne o contato e fale com um atendente!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyqrcode);
                        const bodyfinaliza = {
                          text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                        await UpdateTicketService({
                          ticketData: { status: "closed" },
                          ticketId: ticket.id,
                          companyId: ticket.companyId,
                        });
                      }
                    }).catch(function (error) {
                      console.error(error);
                    });
                  } else {
                    const bodyerro = {
                      text: formatBody(`Ops! Ocorreu um erro e nao consegui desbloquear!`, contact),
                    };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body_mensagem);
                    const bodyerroatendente = {
                      text: formatBody(`Digite *#* e fale com um atendente!`, contact),
                    };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerroatendente);
                  }
                }).catch(async function (error) {
                  const bodyerro = {
                    text: formatBody(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`, contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
                });
              } else {
                const bodysembloqueio = {
                  text: formatBody(`Sua Conexão não está bloqueada! Caso esteja com dificuldades de navegação, retorne o contato e fale com um atendente!`, contact),
                };
                await sleep(2000)
                await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodysembloqueio);
                const bodyfinaliza = {
                  text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                };
                await sleep(2000)
                await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                await UpdateTicketService({
                  ticketData: { status: "closed" },
                  ticketId: ticket.id,
                  companyId: ticket.companyId,
                });
              }
            }).catch(async function (error) {
              const bodyerro = {
                text: formatBody(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`, contact),
              };
              await sleep(2000)
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyerro);
            });
          }
        }).catch(async function (error) {
          const body = {
            text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
          };
          await sleep(2000)
          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
        });
      } else {
        const body = {
          text: formatBody(`Este CPF/CNPJ não é válido!\n\nPor favor tente novamente!\nOu digite *#* para voltar ao *Menu Anterior*`, contact),
        };
        await sleep(2000)
        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
      }
    }
  }
};
