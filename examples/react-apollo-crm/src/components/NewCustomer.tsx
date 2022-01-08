import { useState } from "react";
import { Main } from "./ui/Main";
import { Breadcrumbs } from "./ui/Breadcrumbs";
import { HeaderSection } from "./ui/HeaderSection";
import { PageHeader } from "./ui/PageHeader";
import {
  useGetCompanyWhereQuery,
  useInsertCustomerMutation,
} from "../utils/__generated__/graphql";
import { nhost } from "../utils/nhost";
import { useNavigate } from "react-router";

export function NewCustomer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");

  const user = nhost.auth.getUser();
  let navigate = useNavigate();

  const { data } = useGetCompanyWhereQuery({
    variables: {
      where: {
        companyUsers: {
          userId: {
            _eq: user?.id,
          },
        },
      },
    },
  });

  const [insertCustomer, { loading }] = useInsertCustomerMutation();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log("handle submit");

    let res;
    try {
      res = await insertCustomer({
        variables: {
          customer: {
            name,
            addressLine1,
            companyId: data?.companies[0].id,
          },
        },
      });
    } catch (error) {
      return alert(`error: ${error}`);
    }

    navigate(`/customers/${res.data?.insertCustomer?.id}`);
  };

  return (
    <Main>
      <Breadcrumbs
        backLink={""}
        breadcrumbs={[
          { link: "/customers", text: "Customers" },
          { link: "/new-customer", text: "New Customer" },
        ]}
      />
      <HeaderSection>
        <PageHeader>New Customer</PageHeader>
      </HeaderSection>

      <form onSubmit={handleSubmit}>
        <div className="max-w-3xl mx-auto">
          <div className="pt-12">
            <div className="grid grid-cols-1 mt-6 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="first-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="first-name"
                    id="first-name"
                    autoComplete="given-name"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="street-address"
                  className="block text-sm font-medium text-gray-700"
                >
                  Street address
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="street-address"
                    id="street-address"
                    autoComplete="street-address"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="pt-5">
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center px-4 py-2 ml-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={loading}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </form>
    </Main>
  );
}
