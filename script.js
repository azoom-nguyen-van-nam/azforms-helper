import fs from 'fs'
// import formsApi from './forms-api.js'
import { v4 as uuidv4 } from 'uuid'
import knex from './database.js'
import admin from 'firebase-admin'

const serviceAccount = fs.readFileSync('service-account.json')
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount))
})
const db = admin.firestore()

async function update() {
  const backlogTerms = await getBacklogTerms()
  const resultInsertTerms = await insertBacklogIntoTerms(backlogTerms)
  const sucTermsAgreementIds = resultInsertTerms
    .filter(({ status }) => status === 'fulfilled')
    .map(({ value: sucTermsAgreement }) => sucTermsAgreement[0])

  const sucTermsAgreements = await getSucTermsAgreements(sucTermsAgreementIds)
  const resultInsertFirestore = await insertSessionToFirestore(sucTermsAgreements)
  console.log(resultInsertFirestore)

  //   const mailConfigs = sucTermsAgreements.map(({ email, sessionId }) => {
  //     return gennerateMailContent(email, sessionId)
  //   })
  //   await sendmail(mailConfigs)
}

const getBacklogTerms = () => {
  return knex('to_be_recovered_paper as rp')
    .leftJoin('sublease_user_contract_d as suc', 'suc.suc_id', 'rp.sublease_user_contract_d_id')
    .leftJoin('sublease_user_d as su', 'su.su_id', 'suc.su_id')
    .select('suc.suc_id as sucId')
    .where('suc.status', 2)
    .where('rp.is_recovered', 0)
    .where('rp.type', 5)
    .whereNot('su.mail', '')
    .whereNotNull('su.mail')
}

const insertBacklogIntoTerms = (backlogTerms) => {
  return Promise.allSettled(
    backlogTerms.map(({ sucId }) =>
      knex('sublease_user_contract_terms_agreement')
        .insert({
          sublease_user_contract_id: sucId,
          status: 1,
          status_log: JSON.stringify({ 1: new Date() }),
          is_agreement: 0,
          unique_key: uuidv4()
        })
        .select()
    )
  )
}

const getSucTermsAgreements = (sucTermsAgreementIds) => {
  return knex('sublease_user_contract_terms_agreement as ta')
    .leftJoin('sublease_user_contract_d as suc', 'ta.sublease_user_contract_id', 'suc.suc_id')
    .leftJoin('sublease_user_d as su', 'su.su_id', 'suc.su_id')
    .leftJoin('car_room_d as cr', 'cr.cr_id', 'suc.cr_id')
    .leftJoin('sublease_d as s', 's.s_id', 'cr.s_id')
    .leftJoin('location_parking as lp', 'lp.id', 's.p_id')
    .select(
      'ta.id as sucTermsAgreementId',
      'ta.unique_key as sessionId',
      'su.mail as email',
      'cr.room_name as carRoomName',
      'suc.contract_start_date as contractStartDate',
      'lp.name as parkingName'
    )
    .whereIn('ta.id', sucTermsAgreementIds)
}

const insertSessionToFirestore = (sucTermsAgreements) => {
  // const workspaceId = config.forms.workspaceId
  // const formId = 'GlaLypWaOWXjVzwLbFO6'
  const formId = 'lt88lttCpgQaLtihJwli'
  return Promise.allSettled(
    sucTermsAgreements.map(
      ({ sessionId, email, carRoomName, contractStartDate, sucTermsAgreementId, parkingName }) => {
        const json = {
          email,
          data: {
            carRoomName,
            parkingName,
            contractStartDate,
            sucTermsAgreementId,
            subWebhook: {
              apiUrl: `http://95.111.195.217:5000/sublease-user-contract-terms-agreement/webhook/status`,
              method: 'patch',
              requestBody: {
                sucTermsAgreementId,
                status: 3
              }
            }
          }
        }
        // return formsAPI.post(`api/form/${workspaceId}/${formId}/${sessionId}`, { json })
        return db
          .collection('workspaces')
          .doc('azoom')
          .collection('forms')
          .doc(formId)
          .collection('sessions')
          .doc(sessionId)
          .set(json)
      }
    )
  )
}

const gennerateMailContent = (email, token) => {
  const defaultSender = config.notices.defaultMailSender || ''
  const defaultFromMail = config.notices.defaultMailAddress || ''
  const mailSubject = `【重要 ご確認ください】口座振替不備の件に関しまして【株式会社アズーム】`

  return [
    {
      from: {
        email: defaultFromMail,
        name: defaultSender
      },
      to: email,
      subject: mailSubject,
      text: ''
    }
  ]
}

update()
