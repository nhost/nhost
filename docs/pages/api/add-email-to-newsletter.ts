import mailchimp from '@mailchimp/mailchimp_marketing'

import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  success: boolean
  message: string
}

export default async function addEmailToNewsletter(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | Error>
) {
  const { email } = req.body

  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER
  })

  const tags = []

  if (process.env.NODE_ENV === 'development') {
    tags.push('dev')
  }

  try {
    const response = await mailchimp.lists.addListMember(process.env.MAILCHIMP_AUDIENCE_ID, {
      email_address: email,
      status: 'subscribed',
      tags
    })
  } catch (err) {
    if (err.response && err.response.body.title === 'Member Exists') {
      return res.send({
        success: false,
        message: err.response.body.detail || 'Member already exists'
      })
    }
    throw new Error(err.message || 'Error adding email to newsletter')
  }

  res.status(200).json({ success: true, message: 'Thank you for subscribing!' })
}
