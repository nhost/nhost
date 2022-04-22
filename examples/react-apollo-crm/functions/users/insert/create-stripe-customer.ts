import { Request, Response } from 'express'
import { nhost, stripe } from '../../_utils'

const handler = async (req: Request, res: Response) => {
  console.log(process.env)
  if (req.headers['nhost-webhook-secret'] !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized')
  }

  // User who signed up
  const user = req.body.event.data.new

  // Check if user already has profile
  const GET_PROFILE = `
    query ($id: uuid!) {
      profilesAggregate(where:{_and: [{id: {_eq: $id}}, {stripeCustomerId: {_is_null:false}}]}) {
        aggregate {
          count
        }
      }
    }`

  const { data, error } = await nhost.graphql.request(
    GET_PROFILE,
    {
      id: user.id
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET
      }
    }
  )

  if (error) {
    return res.status(500).send(error)
  }

  if ((data as any).profilesAggregate.aggregate.count === 1) {
    return res.status(200).send('User already has a profile')
  }

  // Create stripe customer
  let stripeCustomerId
  try {
    const stripeCustomer = await stripe.customers.create({
      name: user.email,
      email: user.email,
      metadata: {
        creatorUserid: user.id
      }
    })
    stripeCustomerId = stripeCustomer.id
  } catch (error) {
    console.log('error creating stripe customer')
    console.log(error)
    return res.status(500).send(error)
  }

  // create free subscription
  try {
    await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: import.meta.env.VITE_STRIPE_FREE_PLAN_PRICE_ID
        }
      ]
    })
  } catch (error) {
    console.log('error creating stripe subscription')
    console.log(error)
    return res.status(500).send(error)
  }

  console.log({ stripeCustomerId })

  // Insert stipe customer into database
  // Check if user already has profile
  const INSERT_PROFILE = `
  mutation ($profile: profiles_insert_input!) {
    insertProfile(object: $profile) {
      id
    }
  }
  `

  const { error: insertProfileError } = await nhost.graphql.request(
    INSERT_PROFILE,
    {
      profile: {
        id: user.id,
        stripeCustomerId,
        planId: process.env.NHOST_FREE_PLAN_ID
      }
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET
      }
    }
  )

  if (insertProfileError) {
    console.log(insertProfileError)
    return res.status(500).send(error)
  }

  res.status(200).send(`OK`)
}

export default handler
