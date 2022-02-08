import Footer from '@/components/Footer'
import Header from '@/components/Header'
import Text from '@/components/ui/Text'
import Head from 'next/head'

export default function Home() {
  return (
    <div className="bg-fafafa">
      <Head>
        <title>Nhost Documentation</title>
      </Head>
      <Header />
      <div className="flex flex-row max-w-5xl pb-20 mx-auto space-x-20 mt-36 bg-fafafa">
        <div className="h-screen">
          <Text>Welcome to Nhost</Text>
        </div>
      </div>
      <Footer />
    </div>
  )
}
