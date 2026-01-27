import express, { Request, Response, Application } from 'express';
import { MongoClient } from 'mongodb'; // 1. 도구 가져오기

const app: Application = express();
const PORT: number = 8080;

// 2. DB 주소와 이름 정하기
const url = 'mongodb://127.0.0.1:27017'; 
const client = new MongoClient(url);

// 3. DB 연결 후 서버 띄우기 (이게 가장 간단한 패턴입니다)
async function connectDB() {
    await client.connect(); // 창고 문 열기
    const db = client.db('todoapp'); // 'todoapp' 상자 가져오기
    console.log('DB 연결 성공!');

    app.listen(PORT, () => {
        console.log("listening on 8080");
    });
}

connectDB(); 