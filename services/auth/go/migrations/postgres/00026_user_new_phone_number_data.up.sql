UPDATE auth.users
SET new_phone_number = phone_number,
    phone_number = NULL
WHERE phone_number IS NOT NULL
  AND phone_number_verified = false;
