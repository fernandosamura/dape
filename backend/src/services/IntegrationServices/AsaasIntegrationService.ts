import { WASocket } from "baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { isNumeric, sleep, validaCpfCnpj, sendMessageImage } from "../WbotServices/wbotMessageListener";
import formatBody from "../../helpers/Mustache";
import axios from "axios";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

export interface AsaasSettings {
  asaastk: string;
}

export const handleAsaasBoleto = async (
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  cpfcnpj: string,
  settings: AsaasSettings
): Promise<void> => {
  const { asaastk } = settings;
  let numberCPFCNPJ = cpfcnpj;

  if (asaastk !== "") {
    if (isNumeric(numberCPFCNPJ) === true) {
      if (cpfcnpj.length > 2) {
        const isCPFCNPJ = validaCpfCnpj(numberCPFCNPJ)
        if (isCPFCNPJ) {
          const body = {
            text: formatBody(`Aguarde! Estamos consultando na base de dados!`, contact),
          };
          try {
            await sleep(2000)
            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
          } catch (error) {
          }
          var optionsc = {
            method: 'GET',
            url: 'https://www.asaas.com/api/v3/customers',
            params: { cpfCnpj: numberCPFCNPJ },
            headers: {
              'Content-Type': 'application/json',
              access_token: asaastk
            }
          };

          axios.request(optionsc as any).then(async function (response) {
            let nome;
            let id_cliente;
            let totalCount;

            nome = response?.data?.data[0]?.name;
            id_cliente = response?.data?.data[0]?.id;
            totalCount = response?.data?.totalCount;

            if (totalCount === 0) {
              const body = {
                text: formatBody(`Cadastro não localizado! *CPF/CNPJ* incorreto ou inválido. Tenta novamente!`, contact),
              };
              await sleep(2000)
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
            } else {

              const body = {
                text: formatBody(`Localizei seu Cadastro! \n*${nome}* só mais um instante por favor!`, contact),
              };
              await sleep(2000)
              await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
              var optionsListpaymentOVERDUE = {
                method: 'GET',
                url: 'https://www.asaas.com/api/v3/payments',
                params: { customer: id_cliente, status: 'OVERDUE' },
                headers: {
                  'Content-Type': 'application/json',
                  access_token: asaastk
                }
              };

              axios.request(optionsListpaymentOVERDUE as any).then(async function (response) {
                let totalCount_overdue;
                totalCount_overdue = response?.data?.totalCount;

                if (totalCount_overdue === 0) {
                  const body = {
                    text: formatBody(`Você não tem nenhuma fatura vencidada! \nVou te enviar a proxima fatura. Por favor aguarde!`, contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
                  var optionsPENDING = {
                    method: 'GET',
                    url: 'https://www.asaas.com/api/v3/payments',
                    params: { customer: id_cliente, status: 'PENDING' },
                    headers: {
                      'Content-Type': 'application/json',
                      access_token: asaastk
                    }
                  };

                  axios.request(optionsPENDING as any).then(async function (response) {
                    function sortfunction(a, b) {
                      return a.dueDate.localeCompare(b.dueDate);
                    }
                    const ordenado = response?.data?.data.sort(sortfunction);
                    let id_payment_pending;
                    let value_pending;
                    let description_pending;
                    let invoiceUrl_pending;
                    let dueDate_pending;
                    let invoiceNumber_pending;
                    let totalCount_pending;
                    let value_pending_corrigida;
                    let dueDate_pending_corrigida;

                    id_payment_pending = ordenado[0]?.id;
                    value_pending = ordenado[0]?.value;
                    description_pending = ordenado[0]?.description;
                    invoiceUrl_pending = ordenado[0]?.invoiceUrl;
                    dueDate_pending = ordenado[0]?.dueDate;
                    invoiceNumber_pending = ordenado[0]?.invoiceNumber;
                    totalCount_pending = response?.data?.totalCount;

                    dueDate_pending_corrigida = dueDate_pending?.split('-')?.reverse()?.join('/');
                    value_pending_corrigida = value_pending.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

                    const bodyBoleto = {
                      text: formatBody(`Segue a segunda-via da sua Fatura!\n\n*Fatura:* ${invoiceNumber_pending}\n*Nome:* ${nome}\n*Valor:* R$ ${value_pending_corrigida}\n*Data Vencimento:* ${dueDate_pending_corrigida}\n*Descrição:*\n${description_pending}\n*Link:* ${invoiceUrl_pending}`, contact),
                    };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBoleto);
                    //GET DADOS PIX
                    var optionsGetPIX = {
                      method: 'GET',
                      url: `https://www.asaas.com/api/v3/payments/${id_payment_pending}/pixQrCode`,
                      headers: {
                        'Content-Type': 'application/json',
                        access_token: asaastk
                      }
                    };

                    axios.request(optionsGetPIX as any).then(async function (response) {
                      let success;
                      let payload;

                      success = response?.data?.success;
                      payload = response?.data?.payload;

                      if (success === true) {
                        const bodyPixCP = {
                          text: formatBody(`Este é o *PIX Copia e Cola*`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPixCP);
                        const bodyPix = {
                          text: formatBody(`${payload}`, contact),
                        };
                        await sleep(2000)
                        await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPix);
                        let linkBoleto = `https://chart.googleapis.com/chart?cht=qr&chs=500x500&chld=L|0&chl=${payload}`
                        await sleep(2000)
                        await sendMessageImage(wbot, contact, ticket, linkBoleto, '')
                        var optionsBoletopend = {
                          method: 'GET',
                          url: `https://www.asaas.com/api/v3/payments/${id_payment_pending}/identificationField`,
                          headers: {
                            'Content-Type': 'application/json',
                            access_token: asaastk
                          }
                        };

                        axios.request(optionsBoletopend as any).then(async function (response) {
                          let codigo_barras
                          codigo_barras = response.data.identificationField;
                          const bodycodigoBarras = {
                            text: formatBody(`${codigo_barras}`, contact),
                          };
                          if (response.data?.errors?.code !== 'invalid_action') {
                            const bodycodigo = {
                              text: formatBody(`Este é o *Código de Barras*!`, contact),
                            };
                            await sleep(2000)
                            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodycodigo);
                            await sleep(2000)
                            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodycodigoBarras);
                            const bodyfinaliza = {
                              text: formatBody(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`, contact),
                            };
                            await sleep(2000)
                            await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyfinaliza);
                            await sleep(2000)
                            await UpdateTicketService({
                              ticketData: { status: "closed" },
                              ticketId: ticket.id,
                              companyId: ticket.companyId,
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
                        });
                      }

                    }).catch(async function (error) {
                      const body = {
                        text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
                    });

                  }).catch(async function (error) {
                    const body = {
                      text: formatBody(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`, contact),
                    };
                    await sleep(2000)
                    await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
                  });
                } else {
                  let id_payment_overdue;
                  let value_overdue;
                  let description_overdue;
                  let invoiceUrl_overdue;
                  let dueDate_overdue;
                  let invoiceNumber_overdue;

                  let value_overdue_corrigida;
                  let dueDate_overdue_corrigida;

                  id_payment_overdue = response?.data?.data[0]?.id;
                  value_overdue = response?.data?.data[0]?.value;
                  description_overdue = response?.data?.data[0]?.description;
                  invoiceUrl_overdue = response?.data?.data[0]?.invoiceUrl;
                  dueDate_overdue = response?.data?.data[0]?.dueDate;
                  invoiceNumber_overdue = response?.data?.data[0]?.invoiceNumber;


                  dueDate_overdue_corrigida = dueDate_overdue?.split('-')?.reverse()?.join('/');
                  value_overdue_corrigida = value_overdue.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
                  const body = {
                    text: formatBody(`Você tem *${totalCount_overdue}* fatura(s) vencidada(s)! \nVou te enviar. Por favor aguarde!`, contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, body);
                  const bodyBoleto = {
                    text: formatBody(`Segue a segunda-via da sua Fatura!\n\n*Fatura:* ${invoiceNumber_overdue}\n*Nome:* ${nome}\n*Valor:* R$ ${value_overdue_corrigida}\n*Data Vencimento:* ${dueDate_overdue_corrigida}\n*Descrição:*\n${description_overdue}\n*Link:* ${invoiceUrl_overdue}`, contact),
                  };
                  await sleep(2000)
                  await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyBoleto);
                  //GET DADOS PIX
                  var optionsGetPIX = {
                    method: 'GET',
                    url: `https://www.asaas.com/api/v3/payments/${id_payment_overdue}/pixQrCode`,
                    headers: {
                      'Content-Type': 'application/json',
                      access_token: asaastk
                    }
                  };

                  axios.request(optionsGetPIX as any).then(async function (response) {
                    let success;
                    let payload;

                    success = response?.data?.success;
                    payload = response?.data?.payload;
                    if (success === true) {

                      const bodyPixCP = {
                        text: formatBody(`Este é o *PIX Copia e Cola*`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPixCP);
                      const bodyPix = {
                        text: formatBody(`${payload}`, contact),
                      };
                      await sleep(2000)
                      await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodyPix);
                      let linkBoleto = `https://chart.googleapis.com/chart?cht=qr&chs=500x500&chld=L|0&chl=${payload}`
                      await sleep(2000)
                      await sendMessageImage(wbot, contact, ticket, linkBoleto, '')
                      var optionsBoleto = {
                        method: 'GET',
                        url: `https://www.asaas.com/api/v3/payments/${id_payment_overdue}/identificationField`,
                        headers: {
                          'Content-Type': 'application/json',
                          access_token: asaastk
                        }
                      };

                      axios.request(optionsBoleto as any).then(async function (response) {

                        let codigo_barras
                        codigo_barras = response.data.identificationField;
                        const bodycodigoBarras = {
                          text: formatBody(`${codigo_barras}`, contact),
                        };
                        if (response.data?.errors?.code !== 'invalid_action') {
                          const bodycodigo = {
                            text: formatBody(`Este é o *Código de Barras*!`, contact),
                          };
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodycodigo);
                          await sleep(2000)
                          await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, bodycodigoBarras);
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
                        //console.error(error);
                      });

                    }
                  }).catch(function (error) {

                  });

                }

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
        }
      }
    }
  }
};
