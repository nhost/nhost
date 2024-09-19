import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ApolloError, gql, useMutation } from '@apollo/client'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useAddSecurityKey,
  useElevateSecurityKeyEmail,
  useUserEmail,
  useUserId
} from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { Fingerprint, Info, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

type SecurityKey = {
  id: string
  nickname?: string | undefined
}

type SecurityKeysQuery = {
  authUserSecurityKeys: SecurityKey[]
}

const addSecurityKeySchema = z.object({
  nickname: z.string().min(1)
})

export default function SecurityKeys() {
  const userId = useUserId()
  const email = useUserEmail()
  const { add } = useAddSecurityKey()
  const [keys, setKeys] = useState<SecurityKey[]>([])
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [showAddSecurityKeyDialog, setShowAddSecurityDialog] = useState(false)

  const { refetch: refetchSecurityKeys } = useAuthQuery<SecurityKeysQuery>(
    gql`
      query securityKeys($userId: uuid!) {
        authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
          id
          nickname
        }
      }
    `,
    {
      variables: { userId },
      onCompleted: ({ authUserSecurityKeys }) => {
        if (authUserSecurityKeys) {
          setKeys(authUserSecurityKeys || [])
        }
      }
    }
  )

  const [removeKey] = useMutation<{
    deleteAuthUserSecurityKey?: {
      id: string
    }
  }>(
    gql`
      mutation removeSecurityKey($id: uuid!) {
        deleteAuthUserSecurityKey(id: $id) {
          id
        }
      }
    `,
    {
      onCompleted: ({ deleteAuthUserSecurityKey }) => {
        if (deleteAuthUserSecurityKey?.id) {
          setKeys(($keys) => $keys.filter((key) => key.id !== deleteAuthUserSecurityKey.id))
        }
      }
    }
  )

  const form = useForm<z.infer<typeof addSecurityKeySchema>>({
    resolver: zodResolver(addSecurityKeySchema),
    defaultValues: {
      nickname: ''
    }
  })

  const elevatePermission = async () => {
    if (!elevated && keys.length > 0) {
      try {
        const { elevated } = await elevateEmailSecurityKey(email as string)

        if (!elevated) {
          throw new Error('Permissions were not elevated')
        }
        return true
      } catch {
        toast.error('Could not elevate permissions')
        return false
      }
    }
    return true // Return true if already elevated or no keys
  }

  const onSubmit = async (values: z.infer<typeof addSecurityKeySchema>) => {
    const { nickname } = values

    const permissionGranted = await elevatePermission()

    if (!permissionGranted) {
      return
    }

    const { key, isError, error } = await add(nickname)

    if (isError) {
      toast.error(error?.message)
    } else if (key) {
      setKeys((previousKeys) => [...previousKeys, key])
      setShowAddSecurityDialog(false)
      form.reset()
      await refetchSecurityKeys()
    }
  }

  const handleDeleteSecurityKey = async (id: string) => {
    const permissionGranted = await elevatePermission()

    if (!permissionGranted) {
      return
    }

    try {
      await removeKey({ variables: { id } })
      await refetchSecurityKeys()
    } catch (error) {
      toast.error((error as ApolloError).message)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <CardTitle>Security keys</CardTitle>
          <Button className="m-0" onClick={() => setShowAddSecurityDialog(true)}>
            <Plus />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length === 0 && (
            <Alert className="w-full">
              <Info className="w-4 h-4" />
              <AlertTitle>No security keys</AlertTitle>
              <AlertDescription className="mt-2">
                You can add a security key by clicking <b>Register new device</b>
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-row items-center justify-between w-full px-4 py-2 border rounded-md"
              >
                <div className="flex flex-row gap-2">
                  <Fingerprint />
                  <span className="">{key.nickname || key.id}</span>
                </div>

                <Button variant="ghost" onClick={() => handleDeleteSecurityKey(key.id)}>
                  <Trash />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showAddSecurityKeyDialog}
        onOpenChange={(open) => setShowAddSecurityDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New security key</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col w-full space-y-4">
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="nickname" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button type="submit">Create</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
