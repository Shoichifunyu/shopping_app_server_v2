var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();
var server = https.createServer({
    key: fs.readFileSync('./privatekey.pem'),
    cert: fs.readFileSync('./cert.pem'),
}, app);



//  一問一答処理を管理するためのフラグ（グローバル変数）
var qa_msg_ctrl = false;
// 買い物リスト処理を管理するためのフラグ（グローバル変数）
var act_buy_list_ctrl = false;
// 買い物リスト記録ソケットの数を2以上にしないためのカウントアップ変数
var act_buy_list_cnt = 0;

const json = fs.readFileSync('./list.json', 'utf-8');
const data = JSON.parse(json);
console.log(data);

const io = require("socket.io")(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });


app.use((request, response, next) => {
    if (request.method === 'OPTIONS') {
        console.log("こことおるの？");
        console.log(request.method, request.url);
        // response.header("Access-Control-Allow-Origin", "*");
        // response.header("Access-Control-Allow-Headers", "X-Requested-With");
        // response.header("Access-Control-Allow-Headers", "Content-Type");
        // response.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
        response.append('Access-Control-Allow-Origin', "*")
        response.append('Access-Control-Allow-Origin', 'PUT')
        return response.status(204).send('')
    }
    try {
        console.log(request.method, request.url);
        next();
    } catch(err) {
        console.log(err);
        next(err);
    }
});

app.get("/", function(request, response) {
    // if (request.method === 'GET') {
        console.log("ここはとおるの？");
        console.log(response.method, response.url);
        response.append('Access-Control-Allow-Origin', "*")
        // 確認用
        response.status(200).json({foo: 'bar'});
});

app.post("/api/post", function(request, response) {
    // if (request.method === 'GET') {
        response.append('Access-Control-Allow-Origin', "*")
        // 確認用
        response.status(200).json({method: 'post'});
});

app.put("/api/put", function(request, response) {
    // if (request.method === 'GET') {
        response.append('Access-Control-Allow-Origin', "*")
        // 確認用
        response.status(200).json({method: 'put'});
});

io.on('connection', function(socket){
    console.log("io connected");

    socket.on('chat_before', function(send_msg){
        console.log("chat_bofore connected");
        io.emit('chat_before', send_msg);
    }),

    // 選択肢処理
    socket.on('select_list', function(slct_list){
        for (let i = 0; i < data.length; i++) {
            if ((data[i].pattern === "選択肢") && (slct_list.indexOf(data[i].genre) > -1)) {
                setTimeout(function () {
                    io.emit('select_list', JSON.stringify(data[i]));
                }, 800)
                return;
            } else {
                ;
            }
        }
    }),
    // 従来処理（一問一答）
    socket.on('chat', function(msg){
        console.log("chat connected");
        console.log(msg);
        for (let i = 0; i < data.length; i++) {
            if ((data[i].pattern === "選択肢") && (msg.indexOf(data[i].genre) > -1)) {
                // 代わりに選択肢処理を行う
                return;
            } else if ((data[i].pattern === "一問一答") && (msg.indexOf(data[i].comment) > -1)) {
                    setTimeout(function () {
                        io.emit('chat', data[i].reply);
                    }, 800)
                    return;
            } else if (i < data.length - 1){
                continue;
            } else if (!qa_msg_ctrl) {
                setTimeout(function () {
                    io.emit('chat', "申し訳ございません。対応コメントがありません。");
                }, 800)
                return;
            } else {
                continue;
            }
        }
    }),

    
    // 選択リストのアクション処理
    socket.on('slcted_action', function(slcted_action){
        if (slcted_action === "買う物入力") {
            io.emit('slcted_action', "買うものをここに記録していこう。終わったら「完了」と入力してね。");
            // 買い物リスト処理開始
            act_buy_list_ctrl = false;
            // 一問一答処理停止
            qa_msg_ctrl = true;
        
            if (!act_buy_list_ctrl) {
                // 買い物のリストをJSONファイルに記録する処理
                // 処理の多重化を防ぐため、買い物リスト記録ソケットごとに数を加算していく
                act_buy_list_cnt += 1;
                if (act_buy_list_cnt < 2) {
                    socket.on('buy_item', function(buy_item){                 
                        if (!act_buy_list_ctrl) {
                            function addJSONData(filename,obj){
                                var buy_list = {
                                    pattern: "買い物リスト"
                                };
                                if (obj.indexOf("完了") > -1) {
                                    // 買い物リスト処理の終了
                                    act_buy_list_ctrl = true;
                                    // 一問一答処理停止の解除
                                    qa_msg_ctrl = false;
                                    return;
                                } else {
                                    var read_json = fs.readFileSync('./list.json', 'utf-8');
                                    var read_json_data = JSON.parse(read_json);
                                    buy_list["buy_item"] = obj;
                                    read_json_data.push(buy_list);
                                    fs.writeFileSync(filename,JSON.stringify(read_json_data,null," "),"utf-8");
                                }
                            }
                        addJSONData('./list.json',buy_item);
                        } else {
                            ;
                        }
                    });
                } else {
                    act_buy_list_cnt -= 1;
                }
            }
        } else if (slcted_action === "買う物確認") {
            io.emit('slcted_action', "今までに記録した買う物のリストは以下の通りだよ。");
            var read_json = fs.readFileSync('./list.json', 'utf-8');
            var read_json_data = JSON.parse(read_json);
            for (let i = 0; i < read_json_data.length; i++) {
                if (read_json_data[i].pattern === "買い物リスト") {        
                    io.emit('slcted_action', read_json_data[i].buy_item);
                } else {
                    continue;
                }
            }             
        } else if (slcted_action === "リスト消去") {    
            io.emit('slcted_action', "今までに記録した買う物のリストを消去します。よろしいですか？");
            slcted_action = "";
            io.emit('select_list', JSON.stringify(data[3]));
        } else if (slcted_action === "はい") {
            var read_json = fs.readFileSync('./list.json', 'utf-8');
            var read_json_data = JSON.parse(read_json);
            var deleted_list =  read_json_data.filter(function(list) {
                return list.pattern !== "買い物リスト";
            });
            fs.writeFileSync('./list.json',JSON.stringify(deleted_list,null," "),"utf-8");
            } else {
                ;
            }
    });
    
    socket.on('disconnect', () => {
        // カウントアップの初期化
        act_buy_list_cnt = 0;
        // 買い物リスト処理の終了
        act_buy_list_ctrl = true;
        // 一問一答処理停止の解除
        qa_msg_ctrl = false;
        console.log("disconnected");
      });
});

server.listen(443, () => {
    console.log("start listening")
})