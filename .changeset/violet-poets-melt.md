---
'@nhost/vue': patch
---

Correct use of ref values in action options
The `nestedUnref` helper was not correctly un-refing nested values. For instance, the values the properties of the following metadata were still `refs`:

```jsx
const { signUpEmailPassword } = useSignUpEmailPassword()
const firstName = ref('John')
const lastName = ref('Doe')
signUpEmailPassword(
    email: 'john@world.com',
    password: 'not-1234',
    {
      metadata: { firstName, lastName }
    }
  );
```