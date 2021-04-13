import { useState } from "react";
import { PrivateRoute } from "../components/private-route";
import { Layout } from "../components/app/layout";
import { storage } from "../utils/nhost";

function Files() {
  const [file, setFile] = useState(null);

  function addFile(e) {
    setFile(e.target.files[0]);
  }

  async function upload() {
    try {
      await storage.put("/public/test.png", file);
      // await storage.put(`/public/${uuid}.${extension}`, file);
      // await storage.put(`/public/${file.name}`, file);
    } catch (error) {
      console.log({ error });
      return alert("Upload failed");
    }
    alert("Upload successful");

    // You probably want to save the uploaded file to the database
    // You only need to save the `/public/test.png` part
  }

  return (
    <Layout>
      <div>
        <h1>Files (upload a .png file)</h1>
      </div>
      <div>
        <ul>
          <li>Only upload .png files</li>
          <li>Reload page to see image</li>
        </ul>
      </div>
      <div>
        <input type="file" onChange={addFile} />
        <button onClick={upload}>upload file</button>
      </div>
      <div>
        <img
          src={`${process.env.FLAREACT_PUBLIC_BACKEND_ENDPOINT}/storage/o/public/test.png`}
          style={{ width: "400px" }}
        />
      </div>
    </Layout>
  );
}

export default PrivateRoute(Files);