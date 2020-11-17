let clientId = //client ID for authentication
  "397502072659-0444pfd71cqgppgseqdi058iuq12jkkr.apps.googleusercontent.com";
let apiKey = "AIzaSyAEgGVJ18CRNCd8BQDVEjjhUGa0P_5cwQI"; //API Key for authentication
let scopes = "https://www.googleapis.com/auth/gmail.modify"; //Scopes for account access
let pageToken; //Used to store the token for next page
let query = document.querySelector("#search-value").value;

document.querySelector("#authorize-button").addEventListener("click", () => {
  //Starts authentication process if not authenticated previously
  handleAuthClick();
});

document.querySelector("#next-page").addEventListener("click", () => {
  //Call the next page
  displayInbox(query);
});

document.querySelector("#search-button").addEventListener("click", (e) => {
  //Search button handling
  e.preventDefault();
  displayInbox(query);
});

function handleClientLoad() {
  //Invoked by Google API JS script
  gapi.client.setApiKey(apiKey); //Sets API Key
  window.setTimeout(checkAuth, 1);
}

function checkAuth() {
  //Validates client ID and scopes
  gapi.auth.authorize(
    //Checks if user had previously authenticated our app with Google
    {
      client_id: clientId,
      scope: scopes,
      immediate: true, //Don't show the login modal
    },
    handleAuthResult
  );
}

function handleAuthClick() {
  //Validates client ID when authorize button is pressed
  gapi.auth.authorize(
    {
      client_id: clientId,
      scope: scopes,
      immediate: false, //Show the login modal
    },
    handleAuthResult
  );
  return false;
}

function handleAuthResult(authResult) {
  if (authResult && !authResult.error) {
    //If authenticated
    loadGmailApi();
    $("#authorize-button").remove();
    $(".table-inbox").removeClass("d-none");
    $("#sign-out").removeClass("d-none");
    $("#compose-button").removeClass("d-none");
    $("#next-page").removeClass("d-none");
  } else {
    $("#authorize-button").removeClass("d-none");
    $("#authorize-button").on("click", function () {
      handleAuthClick();
    });
  }
}

function loadGmailApi() {
  //Loads gmail API functionality
  gapi.client.load("gmail", "v1", displayInbox);
}

function displayInbox(query) {
  //Starter function for displaying emails
  listMessages(pageToken, query).then(function (response) {
    //Fetches messages
    if (response.nextPageToken) {
      pageToken = response.nextPageToken; // Used to get the next page next time
    }

    if (response.messages) {
      Promise.all(response.messages.map(getMessage)).then(function (messages) {
        //Iterate over all messages and display
        $("tbody tr").remove(); //When searching or calling next page remove existing rows
        messages.forEach(appendMessageRow); //Append rows with email data
      });
    }
  });
}

function listMessages(pageToken, query) {
  return new Promise(function (resolve) {
    //Create a new promise to obtain the emails in order
    let options = {
      //Object with all necessary parameters
      userId: "me",
      labelIds: "INBOX",
      maxResults: 10,
      q: query, //Used for search
    };
    if (pageToken) {
      //For next page
      options.pageToken = pageToken;
    }
    let request = gapi.client.gmail.users.messages.list(options); //This return the message ID of the emails
    request.execute(resolve);
  });
}

function getMessage(message) {
  return new Promise(function (resolve) {
    let messageRequest = gapi.client.gmail.users.messages.get({
      //This gets the the actual message from the message ID
      userId: "me",
      id: message.id,
    });
    messageRequest.execute(resolve);
  });
}

function appendMessageRow(message) {
  let reply_to = (getHeader(message.payload.headers, "Reply-to") !== "" //Variable used to find whom to reply when pressing reply button on opened email
    ? getHeader(message.payload.headers, "Reply-to") //If "Reply-to" header is unavailable, use "From"
    : getHeader(message.payload.headers, "From")
  ).replace(/\"/g, "&quot;");

  let reply_subject = //Append Re:
    "Re: " +
    getHeader(message.payload.headers, "Subject").replace(/\"/g, "&quot;");

  $(".table-inbox tbody").append(
    "<tr>\
            <td>" +
      getHeader(message.payload.headers, "From") + //Get "From"
      '</td>\
            <td>\
              <a href="#message-modal-' +
      message.id +
      '" data-toggle="modal" id="message-link-' +
      message.id +
      '">' +
      getHeader(message.payload.headers, "Subject") + //Get "Subject"
      "</a>\
            </td>\
            <td>" +
      getHeader(message.payload.headers, "Date") + //Get "Date"
      "</td>\
          </tr>"
  );

  $("body").append(
    //Used to create the modal to display the email content
    '<div class="modal fade" id="message-modal-' +
      message.id +
      '" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">\
            <div class="modal-dialog modal-lg">\
              <div class="modal-content">\
                <div class="modal-header">\
                  <h4 class="modal-title" id="myModalLabel"> <b>' +
      getHeader(message.payload.headers, "Subject") + //Display subject as the header
      '</b></h4>\
                  <button type="button"\
                  class="close"\
                  data-dismiss="modal"\
                  aria-label="Close">\
                  <span aria-hidden="true">&times;</span></button>\
                </div>\
                <div class="modal-body">\
                  <iframe id="message-iframe-' + //Message body
      message.id +
      '" srcdoc="<p>Loading...</p>">\
                  </iframe>\
                </div>\
                <div class="modal-footer">\
                  <button type="button" class="btn btn-danger" data-dismiss="modal">Close</button>\
                  <button type="button" class="btn btn-primary reply-button" data-dismiss="modal" data-toggle="modal" data-target="#reply-modal"\
                  onclick="fillInReply(\
                    \'' + //Message footer; close button and reply button
      reply_to +
      "', \
                    '" +
      reply_subject +
      "', \
                    '" +
      getHeader(message.payload.headers, "Message-ID") +
      "'\
                    );\"\
                    >Reply\
                  </button>\
                </div>\
              </div>\
            </div>\
          </div>"
  );

  document //Event listener - click on subject to open the message
    .querySelector("#message-link-" + message.id)
    .addEventListener("click", function () {
      let ifrm = $("#message-iframe-" + message.id)[0].contentWindow.document;
      $("body", ifrm).html(getBody(message.payload));
    });
}

function getHeader(headers, index) {
  //Gets the needed header from the headers object
  let header = "";

  $.each(headers, function () {
    if (this.name === index) {
      header = this.value;
    }
  });
  return header;
}

function getBody(message) {
  //Display the body of the message
  let encodedBody = "";
  if (typeof message.parts === "undefined") {
    encodedBody = message.body.data;
  } else {
    encodedBody = getHTMLPart(message.parts);
  }
  encodedBody = encodedBody
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s/g, "");
  return decodeURIComponent(escape(window.atob(encodedBody)));
}

function getHTMLPart(arr) {
  //Gmail API sends data in chunks so used to deal with that
  for (let x = 0; x <= arr.length; x++) {
    if (typeof arr[x].parts === "undefined") {
      if (arr[x].mimeType === "text/html") {
        return arr[x].body.data;
      }
    } else {
      return getHTMLPart(arr[x].parts);
    }
  }
  return "";
}

function sendEmail() {
  //Send button handling
  $("#send-button").addClass("disabled"); //To prevent user from re-clicking until the request has been processed

  sendMessage(
    {
      //Get values from DOM
      To: $("#compose-to").val(),
      Subject: $("#compose-subject").val(),
    },
    $("#compose-message").val(),
    composeTidy
  );

  return false;
}

function sendMessage(headers_obj, message, callback) {
  let email = "";

  for (let header in headers_obj) //Append headers
    email += header += ": " + headers_obj[header] + "\r\n";

  email += "\r\n" + message; //Append message body

  let sendRequest = gapi.client.gmail.users.messages.send({
    //Call the Google API to send the message
    userId: "me",
    resource: {
      raw: window.btoa(email).replace(/\+/g, "-").replace(/\//g, "_"),
    },
  });

  return sendRequest.execute(callback);
}

function composeTidy() {
  //Back to default values
  $("#compose-modal").modal("hide");

  $("#compose-to").val("");
  $("#compose-subject").val("");
  $("#compose-message").val("");

  $("#send-button").removeClass("disabled");
}

function fillInReply(to, subject, message_id) {
  //Called on onClick for reply
  $("#reply-to").val(to);
  $("#reply-subject").val(subject);
  $("#reply-message-id").val(message_id);
}

function sendReply() {
  //Called from DOM
  $("#reply-button").addClass("disabled");

  sendMessage(
    //Call send message function with all values
    {
      To: $("#reply-to").val(),
      Subject: $("#reply-subject").val(),
      "In-Reply-To": $("#reply-message-id").val(),
    },
    $("#reply-message").val(),
    replyTidy
  );

  return false;
}

function replyTidy() {
  //Back to default values
  $("#reply-modal").modal("hide");
  $("#reply-message").val("");
  $("#reply-button").removeClass("disabled");
}
