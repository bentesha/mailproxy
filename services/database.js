const shortid = require("shortid");
const moment = require("moment");
const knex = require("knex");
const knexfile = require("../knexfile");

const db = knex(knexfile.development);

exports.canSendEmail = async sender => {
  const profile = await exports.getProfile(sender);
  if (profile.blocked) {
    await exports.log(sender, 'Address Blocked');
    return false;
  }
  if (profile.lastEmailTime) {
    const nextTime = moment(profile.lastEmailTime).add(1, "minutes");
    const canSend = moment().isAfter(nextTime);
    if(!canSend){
      await exports.log(sender, 'Throttling');
    }
    return canSend;
  }
  return true;
};

exports.log = (sender, type) => {
  const data = {
    id: shortid.generate(),
    email: sender,
    datetime: moment().format(),
    type
  };
  return db.into("logs").insert(data);
};

exports.logEmailSent = async sender => {
  const data = {
    id: shortid.generate(),
    email: sender,
    datetime: moment().format()
  };
  await exports.getProfile(sender);
  await db
    .into("profile")
    .where({ email: sender })
    .update({ lastEmailTime: moment().format() });
  return db.into("sent_emails").insert(data);
};

exports.logAuthFailed = async username => {
  const data = {
    id: shortid.generate(),
    email: username,
    datetime: moment().format(),
    type: "Auth Failed"
  };
  await exports.incrementFailedAuth(username);
  return db.into("logs").insert(data);
};

exports.canAuthenticate = async username => {
  const profile = await exports.getProfile(username);
  if (profile.blocked) {
    await exports.log(username, 'Address Blocked');
    return false;
  }
  const entry = await db
    .from("logs")
    .where({ email: username, type: "Auth Failed" })
    .orderBy("datetime", "desc")
    .limit(1)
    .select()
    .first();
  if (!entry) {
    return true;
  }
  //Allow auth attempt after at least 2 minutes
  const nextTime = moment(entry.datetime).add(1, "minutes");
  const yes = moment().isAfter(nextTime);
  if(!yes){
    await exports.log(username, 'Throttling Auth');
  }
  return yes;
};

exports.getProfile = async username => {
  const profile = await db
    .from("profile")
    .where({ email: username })
    .select()
    .first();
  if (!profile) {
    //Create profile if it does not exist
    return db
      .into("profile")
      .insert({
        email: username
      })
      .then(() => {
        return { email: username };
      });
  } else {
    return profile;
  }
};

exports.incrementFailedAuth = async username => {
  const maxFailures = 5;
  await db
    .from("profile")
    .where({ email: username })
    .increment("failedAuths", 1);

  const profile = await exports.getProfile(username);

  if (profile.failedAuths >= maxFailures) {
    await exports.log(usernmae, 'Blocking Sender');
    await db
      .from("profile")
      .where({ email: username })
      .update({
        blocked: true
      });
  }
};

exports.clearFailedAuth = async username => {
  return db
    .from("profile")
    .where({ email: username })
    .update({
      failedAuths: 0,
      blocked: 0
    });
};
