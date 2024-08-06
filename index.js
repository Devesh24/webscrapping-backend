const express = require("express");
const app = express();

const dataRoute = require("./data");

const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use("/data", dataRoute);

app.listen(process.env.PORT || 5000, () => {
  console.log("Backend server is running..");
});
