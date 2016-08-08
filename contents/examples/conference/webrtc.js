/*!
간략한 시나리오.
1. offer가 SDP와 candidate전송
2. answer는 offer가 보낸 SDP와 cadidate를 Set한다.
3. answer는 응답할 SDP와 candidate를 얻어서 offer한테 전달한다.
4. offer는 응답 받은 SDP와 candidate를 Set한다.
*/

$(function() {
  console.log('Loaded webrtc');

  // cross browsing
  navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
  var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
  var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;

  var socket = io();
  var channel = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
  var userID = Math.round(Math.random() * 999999999) + 999999999;
  var isOffer = null;
  var localStream = null;
  var peer = null; // offer or answer peer
  var iceServers = {
    'iceServers': [{
      'url': 'stun:stun.l.google.com:19302'
    }, {
      'url': 'turn:107.150.19.220:3478',
      'credential': 'turnserver',
      'username': 'subrosa'
    }]
  };
  var peerConnectionOptions = {
    'optional': [{
      'DtlsSrtpKeyAgreement': 'true'
    }]
  };
  var mediaConstraints = {
    'mandatory': {
      'OfferToReceiveAudio': true,
      'OfferToReceiveVideo': true
    }
  };

  // DOM
  var $body = $('body');
  var $roomList = $('#room-list')
  var $videoWrap = $('#video-wrap');
  var $uniqueToken = $('#unique-token');
  var $joinWrap = $('#join-wrap')

  /**
  * getUserMedia
  */
  function getUserMedia() {
    console.log('getUserMedia');

    navigator.getUserMedia({
      audio: true,
      video: true
    }, function(stream) {
      localStream = stream;
      $videoWrap.append('<video id="local-video" muted="muted" autoplay="true" src="' + URL.createObjectURL(localStream) + '"></video>');
      $body.addClass('room wait');

      $('#token-wrap').slideDown(1000);

      if (isOffer) {
        createPeerConnection();
        createOffer();
      }
    }, function() {
      console.error('Error getUserMedia');
    });
  }

  /**
  * createOffer
  * offer SDP를 생성 한다.
  */
  function createOffer() {
    console.log('createOffer', arguments);

    peer.addStream(localStream); // addStream 제외시 recvonly로 SDP 생성됨
    peer.createOffer(function(SDP) {
      peer.setLocalDescription(SDP);
      console.log("Sending offer description", SDP);
      send({
        sender: userID,
        to: 'all',
        sdp: SDP
      });
    }, onSdpError, mediaConstraints);
  }

  /**
  * createAnswer
  * offer에 대한 응답 SDP를 생성 한다.
  * @param {object} msg offer가 보내온 signaling
  */
  function createAnswer(msg) {
    console.log('createAnswer', arguments);

    peer.addStream(localStream);
    peer.setRemoteDescription(new RTCSessionDescription(msg.sdp), function() {
      peer.createAnswer(function(SDP) {
        peer.setLocalDescription(SDP);
        console.log("Sending answer to peer.", SDP);
        send({
          sender: userID,
          to: 'all',
          sdp: SDP
        });
      }, onSdpError, mediaConstraints);
    }, function() {
      console.log('setRemoteDescription', arguments);
    });
  }

  /**
  * createPeerConnection
  * offer, answer 공통 메서드
  */
  function createPeerConnection() {
    console.log('createPeerConnection');

    peer = new webkitRTCPeerConnection(iceServers, peerConnectionOptions);
    console.log('peer', peer);

    peer.onicecandidate = function(event) {
      if (event.candidate) {
        send({
          userID: userID,
          to: 'all',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        });
      } else {
        console.info('Candidate denied', event.candidate);
      }
    };

    peer.onaddstream = function(event) {
      console.log("Adding remote strem", event);

      $videoWrap.append('<video id="remote-video" autoplay="true" src="' + URL.createObjectURL(event.stream) + '"></video>');
      $body.removeClass('wait').addClass('connected');
    };

    peer.onremovestream = function(event) {
      console.log("Removing remote stream", event);
    };
  }

  function onSdpError() {
    console.log('onSdpError', arguments);
  }

  function send(data) {
    console.log('send', data);
    socket.send(data);
  }

  function onmessage(data) {
    console.log('onmessage', data);

    var msg = data;
    var sdp = msg.sdp || null;

    // 접속자가 보내온 offer처리
    if (sdp) {
      if (sdp.type  == 'offer') {
        createPeerConnection();
        console.log('Adding local stream...');
        createAnswer(msg);

      // offer에 대한 응답 처리
      } else if (sdp.type == 'answer') {
        // answer signaling
        peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }

    // offer, answer cadidate처리
    } else if (msg.candidate) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: msg.label,
        candidate: msg.candidate
      });

      peer.addIceCandidate(candidate);
    } else {
      //console.log()
    }
  }

  /**
   * setRoomToken
   */
  function setRoomToken() {
    //console.log('setRoomToken', arguments);

    if (location.hash.length > 2) {
      $uniqueToken.length && $uniqueToken.attr('href', location.href);
    } else {
      location.hash = '#' + (Math.random() * new Date().getTime()).toString(32).toUpperCase().replace(/\./g, '-');
    }
  }

  function setClipboard() {
    //console.log('setClipboard', arguments);

    $uniqueToken.click(function(){
      var link = location.href;
      if (window.clipboardData){
        window.clipboardData.setData('text', link);
        $.message('Copy to Clipboard successful.');
      }
      else {
        window.prompt("Copy to clipboard: Ctrl+C, Enter", link); // Copy to clipboard: Ctrl+C, Enter
      }
    });
  }

  Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        size++;
      }
    }
    return size;
  };

  function onFoundUser() {
    $roomList.html([
      '<div class="room-info">',
        '[' + userID + '] 님이 기다리고 있어요. 참여 하실래요?<br/>',
        '<button id="' + userID + '">Join</button>',
      '</div>'].join('\n'));

    var $joinButton = $roomList.find('button');
    $joinButton.click(function() {
      isOffer = true;
      getUserMedia();
      $(this).attr('disabled', true);
    });

    $joinWrap.slideUp(1000);
    $('#token-wrap').slideUp(1000);
  }

  function initialize() {
    $('#start').click(function() {
      $(this).attr('disabled', true);
      getUserMedia();
    });

    $('#your-name').change(function() {
      userID = $(this).val();
    });

    setRoomToken();
    setClipboard();

  }
  initialize();

  socket.emit('joinRoom', channel, userID);
  socket.on('joinRoom', function(channel, nickName, userList) {
    console.log('joinRoom', arguments);

    if (Object.size(userList) > 1) {
      onFoundUser();
    }
  });

  socket.on('message', function(data) {
    onmessage(data);
  });
});
