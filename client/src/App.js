import Playground from "./Components/Playground/Playground";
import "./App.css";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Playground />
    </>
  );
}

export default App;
