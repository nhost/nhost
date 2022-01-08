import { Main } from "./ui/Main";
import { Breadcrumbs } from "./ui/Breadcrumbs";
import { HeaderSection } from "./ui/HeaderSection";
import { PageHeader } from "./ui/PageHeader";

import { useParams } from "react-router";
import { useCustomerQuery } from "../utils/__generated__/graphql";
import { NavLink, Outlet } from "react-router-dom";
import classNames from "classnames";
import { CustomerActivities } from "./CustomerActivities";
import { CustomerAddComment } from "./CustomerAddComment";

const tabs = [
  { name: "Overview", href: "" },
  { name: "Orders", href: "orders" },
  { name: "Files", href: "files" },
];

export function Customer() {
  const { customerId } = useParams();

  const { data, loading } = useCustomerQuery({
    variables: {
      customerId,
    },
  });

  if (loading) {
    return <div>Loading..</div>;
  }

  if (!data || !data.customer) {
    return <div>No customer..</div>;
  }

  const { customer } = data;

  return (
    <Main>
      <Breadcrumbs
        backLink={""}
        breadcrumbs={[
          { link: "/customers", text: "Customers" },
          { link: `customers/${customerId}`, text: customer.name },
        ]}
      />
      <HeaderSection>
        <PageHeader>{customer.name}</PageHeader>
      </HeaderSection>

      <div className="mt-4">
        <div className="sm:hidden">
          <label htmlFor="current-tab" className="sr-only">
            Select a tab
          </label>
          <select
            id="current-tab"
            name="current-tab"
            className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            defaultValue={"ok"}
          >
            <option>1</option>
            <option>2</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <nav className="flex -mb-px space-x-8">
            {tabs.map((tab) => (
              <NavLink
                to={tab.href}
                className={({ isActive }) => {
                  return classNames(
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                    "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm"
                  );
                }}
              >
                {tab.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="py-12 border-b">
        Details: <Outlet />
      </div>

      <div className="grid grid-cols-2 py-10 space-x-4">
        <div className="">
          <CustomerActivities />
        </div>
        <CustomerAddComment />
      </div>
    </Main>
  );
}
