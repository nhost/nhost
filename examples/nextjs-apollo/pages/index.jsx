import { PrivateRoute } from "@/components/private-route";
import { Layout } from "@/components/app/layout";
import { AddItem } from "@/components/app/add-item";
import { ListItems } from "@/components/app/list-items";

function Dashboard() {
  return (
    <Layout>
      <div>
        <h1>Dashboard</h1>
      </div>
      <div>
        <AddItem />
      </div>
      <div>
        <ListItems />
      </div>
    </Layout>
  );
}

export default PrivateRoute(Dashboard);
