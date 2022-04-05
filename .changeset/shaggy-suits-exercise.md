---
'@nhost/react': minor
---

Return a promise with the current context to hooks actions
It is now possible to get the result of an action. Hook handlers return the action context in a promise.

```jsx
const { signInEmailPasswordless, isError } = useSignInEmailPasswordless()
const MyComponent = () => {
    return <div>
                <button onClick={async () => {
                    const { isSuccess, isError, error } = await signInEmailPasswordless('johan@ikea.se')
                    if (isError) {
                        console.log(error)
                    }}}/>
                {isError && <div>an error occurred</div>}
            <div>
}

```
