import { NhostClient, NhostProvider, useNhostClient } from '@nhost/react'
import { StatusBar } from 'expo-status-bar'
import gql from 'graphql-tag'
import { useState } from 'react'
import { Button, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native'

const client = new NhostClient({
  subdomain: 'localhost'
})

interface Author {
  id: string
  name: string
}

function AuthorsList() {
  const [authors, setAuthors] = useState<Author[]>([])
  const client = useNhostClient()

  async function fetchAuthors() {
    const { data, error } = await client.graphql.request<{ authors: Author[] }>(gql`
      {
        authors {
          id
          name
        }
      }
    `)

    if (error) {
      console.error(error)

      return
    }

    setAuthors(data.authors)
  }

  return (
    <View>
      <Button title="Fetch Authors" onPress={fetchAuthors} />
      <FlatList data={authors} renderItem={({ item }) => <Text>{item.name}</Text>} />
    </View>
  )
}

export default function App() {
  return (
    <NhostProvider nhost={client}>
      <SafeAreaView style={styles.container}>
        <AuthorsList />
        <StatusBar />
      </SafeAreaView>
    </NhostProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  }
})
