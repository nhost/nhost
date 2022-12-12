---
'@nhost/react': major
---

Remove deprecated signatures in React hooks

It is not not possible to send the input values of the following hooks when creating them:

- `useChangeEmail`
- `useChangePassword`
- `useResetPassword`
- `useSendVerificationEmail`
- `useSignInEmailPassword`
- `useSignInEmailPasswordless`
- `useSignUpEmailPassword`

For instance, it is not possible to do the following:

```tsx
const [email, setEmail] = useState('')
const {changeEmail} = useChangeEmail(email)

const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    await changeEmail()
}

return <form onSubmit={handleSubmit}>
            <input value={email} onChange={onChange={(event) => setEmail(event.target.value)}}  />
       </form>
```

Instead, write:

```tsx
const [email] = useState('')
const {changeEmail} = useChangeEmail(email)

const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    await changeEmail(email)
}

return <form onSubmit={handleSubmit}>
            <input value={email} onChange={onChange={(event) => setEmail(event.target.value)}}  />
       </form>

```
