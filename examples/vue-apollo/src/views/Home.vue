<template>
  <div class="login-container" id="home">
    <h2>Your Todos</h2>
    <view-todos></view-todos>
    <add-todo></add-todo>
  </div>
  <logout></logout>
</template>

<style>
#home ul {
  text-align: left;
  list-style-type: none;
  padding: 0px;
  margin: 0px;
}

#home li {
  margin-bottom: 5px;
}

#home h2 {
  text-align: left;
}

#home form {
  margin-top: 20px;
  display: flex;
  align-items: center;
}

#home > form > input {
  border-radius: 4px;
  border: 0;
  padding: 5px;
  display: inline-block;
  width: 85%;
}

#home > form > button {
  border: none;
  background: none;
  display: inline-block;
  color: black;
  width: 15%;
}

#home .mdi-plus {
  font-size: 2em;
}
</style>
<script>
// @ is an alias to /src
import ViewTodos from "@/components/ViewTodos.vue";
import AddTodo from "../components/AddTodo.vue";
import Logout from "../components/Logout.vue";

export default {
  name: "Home",
  components: {
    ViewTodos,
    AddTodo,
    Logout,
  },
};
</script>
