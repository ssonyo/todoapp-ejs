import express, { Request, Response, Application } from 'express';
import { MongoClient, Db, ObjectId } from 'mongodb';

const app: Application = express();
const PORT: number = 8080;

// [1] EJS 설정: "views 폴더 안의 .ejs 파일을 쓸 거야"
app.set('view engine', 'ejs');

// 1. HTML <form> 태그로 보낸 데이터를 해석해줌 (지금 사용자님께 필요한 것)
app.use(express.urlencoded({ extended: true }));

// 2. 나중에 리액트나 AJAX로 보낼 JSON 데이터를 해석해줌
app.use(express.json());

// [2] MongoDB 연결 설정
let db: Db;
const url: string = 'mongodb://127.0.0.1:27017'; // 로컬 DB 주소
const client = new MongoClient(url);

async function connectDB() {
    try {
        await client.connect();
        db = client.db('todoapp'); // 'todoapp'이라는 이름의 DB에 접속
        console.log('✅ MongoDB 연결 성공! 이제 서버를 시작합니다.');

        // DB 연결이 성공한 후에만 서버를 띄웁니다.
        app.listen(PORT, () => {
            console.log(`🚀 서버 가동 중: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ DB 연결 실패:', err);
    }
}

connectDB();

// --- 라우팅 (경로 설정) ---

// 1. 메인 페이지: index.html 보여주기
app.get('/', (req: Request, res: Response) => {
    res.sendFile(__dirname + '/index.html');
});

// 2. 글 목록 페이지: DB에서 데이터 꺼내와서 EJS에 꽂아주기
app.get('/list', async (req: Request, res: Response) => {
    try {
        // 'posts' 컬렉션의 모든 데이터를 찾아서 배열로 변환
        const result = await db.collection('posts').find().toArray();
        
        // 브라우저에 list.ejs 파일을 보내는데, DB 데이터를 'posts'라는 이름으로 담아서 보냄
        res.render('list.ejs', { posts: result });
    } catch (err) {
        console.error(err);
        res.status(500).send('데이터 조회 중 에러 발생');
    }
});


app.get('/write', (req: Request, res: Response) => {
    res.render('write.ejs');
});


app.post('/add', async (req: Request, res: Response) => {
    // 1. 브라우저가 보낸 데이터가 잘 왔는지 확인
    console.log(req.body);
    try {
        // 2. db posts 컬렉션에 집어넣기
        await db.collection('posts').insertOne({
            title: req.body.title,
            content: req.body.content,
            dueDate: req.body.dueDate,
            createdAt: new Date()
        });
        res.redirect('/list');
    } catch (e) {
        console.log(e);
        res.status(500).send('서버에러 발생')
    }
});


app.get("/detail/:id", async (req: Request, res: Response) => {
    
    try {
        const targetId = req.params.id;
        const data = await db.collection('posts').findOne({_id : new ObjectId(targetId)});

        if (data==null) {
            return res.status(404).send("게시물이 존재하지 않습니다.")
        }
        res.render("detail.ejs", { data: data })

    } catch (e) {
        console.log(e);
        res.status(500).send('서버에러 발생')
    }
});



app.post("/delete/:id", async (req: Request, res: Response) => {
    try {
        //1. url에 담긴 id값 꺼내기
        console.log("삭제요청이 왔다!")
        const targetId = req.params.id;

        //2. 타입이 문자열인경우
        //2-1 해당 id 가진 데이터 삭제하기
        if (typeof req.params.id == 'string') {
            await db.collection('posts').deleteOne({
                _id: new ObjectId(targetId)
            });          
            //2-2 삭제완료 후 다시 목록으로 이동
            res.redirect('/list');
        
        } else { //3. 문자열이 아닌경우
            res.status(400).send("잘못된 요청입니다 (id != str)")
        }

    } catch (e) {
        console.log(e);
        res.status(500).send('삭제 중 에러가 발생!')
    }
})