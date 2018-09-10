const Server = require("smtp-server").SMTPServer;
const nodemailer = require("nodemailer");
const MailParser = require("mailparser").MailParser;
const fs = require("fs");
const shortid = require("shortid");
const database = require("./services/database");

const authenticate = (auth, session, callback) => {
  console.log("Authenticating " + auth.username);

  const yes = database.canAuthenticate(auth.username).catch(callback);
  if (!yes) {
    callback('Cannot authenticate ' + auth.username);
  }

  const mailer = nodemailer.createTransport({
    host: "nlssr4.supercp.com",
    port: 25,
    secure: false,
    auth: {
      user: auth.username,
      pass: auth.password
    }
  });

  mailer.verify(async error => {
    if (error) {
      console.log("Authentication failed");
      await database.logAuthFailed(auth.username);
      callback(error);
    } else {
      await database.clearFailedAuth(auth.username);
      console.log("Authenticated " + auth.username);
      callback(null, { user: auth.username });
    }
  });
  session.mailer = mailer;
};

const connect = (session, callback) => {
  console.log("Connecting");
  console.log("Remote address: " + session.remoteAddress);
  callback();
};

const close = session => {
  console.log("Connection closed :" + session.remoteAddress);
};

const validateSender = (sender, _, callback) => {
  if (typeof sender.address !== "string" || !sender.address.includes("@")) {
    console.log("Invalid Email address");
    return callback("Invalid email address");
  }
  const tokens = sender.address.split("@");
  const domain = tokens[tokens.length - 1];
  if (domain !== "dermtz.com") {
    console.log("Domain not allowed: " + domain);
    return callback("Domain not allowed: " + domain);
  }

  database
    .canSendEmail(sender.address)
    .then(yes => {
      yes ? callback() : callback("Cannot send email: " + sender.address);
    })
    .catch(callback);
};

const processData = (stream, session, callback) => {
  console.log("Processing email");
  const parser = new MailParser();
  const email = {};
  email.attachments = [];
  parser.on("headers", headers => {
    const from = headers.get("from");
    const to = headers.get("to");
    const cc = headers.get("cc");
    const bcc = headers.get("bcc");

    if(Array.isArray(from.value)){
      email.sender = from.value[0].address;
    }

    email.to = to && to.text;
    email.from = from && from.text;
    email.cc = cc && cc.text;
    email.bcc = bcc && bcc.text;
    email.subject = headers.get("subject");
  });
  parser.on("data", data => {
    if (data.type === "attachment") {
      //email.attachments.push(data.content);
      const path = __dirname + "/tmp/" + shortid.generate() + data.filename;
      stream = fs.createWriteStream(path);
      data.content.pipe(stream);
      data.content.on("end", () => data.release());
      email.attachments.push({
        filename: data.filename,
        path
      });
    } else if (data.type === "text") {
      email.html = data.html;
      email.text = data.text;
    }
  });
  parser.on("end", () => {
    session.mailer.sendMail(email, async error => {
      if (error) {
        console.log("Sending email failed");
      } else {
        console.log("Email sent");
        await database.logEmailSent(email.sender);
      }
      callback(error);
      //Remove temp attachment files
      email.attachments.forEach(attachment => {
        fs.unlink(attachment.path, error => {
          error && console.log("Error deleting temp file: " + attachment.path, error);
        });
      });
    });
  });
  parser.on("error", error => {
    console.log("Error parsing email", error);
    callback(error);
  });
  stream.pipe(parser);
};

const serverOptions = {
  name: "smtp.localhost",
  secure: false,
  onAuth: authenticate,
  onConnect: connect,
  onClose: close,
  onMailFrom: validateSender,
  onData: processData
};

const server = new Server(serverOptions);
const port = process.env.PORT || 2525;
server.listen(port, () => {
  console.log("Listening on port " + port);
});

server.on("error", error => {
  console.log("Error: ", error);
});
