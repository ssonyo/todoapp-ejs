import express, { Request, Response, Application } from 'express';
import { MongoClient, Db, ObjectId } from 'mongodb';
import passport from 'passport';
import session from 'express-session';
import { Strategy as LocalStrategy } from 'passport-local';

const app: Application = express();
const PORT: number = 8080;

// EJS 설정: "views 폴더 안의 .ejs 파일을 쓸 거야"
app.set('view engine', 'ejs');

// html <form> => req.body로 데이터 받기 위한 설정
app.use(express.urlencoded({ extended: true }));
// ajax, JSON 데이터 받기 위한 설정
app.use(express.json());

// MongoDB 연결 설정
let db: Db;
const url: string = 'mongodb://127.0.0.1:27017'; // 로컬 DB 주소
const client = new MongoClient(url);



// 로그인 관련 설정

// [1] 세션 설정 (문지기가 발행할 신분증 보관함)
app.use(session({
  secret: 'keyboard cat', // 아무 글자나 길게 쓰세요
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 하루 동안 유지
}));

// [2] 패스포트 초기화
app.use(passport.initialize());
app.use(passport.session());

// [3] 로그인 검증 로직 (Local Strategy)
passport.use(new LocalStrategy({
  usernameField: 'username', // form의 input name과 맞춰야 함
  passwordField: 'password',
  session: true,
}, async (inputUsername, inputPassword, done) => {
  try {
    // DB에서 해당 유저 찾기
    const user = await db.collection('users').findOne({ username: inputUsername });

    if (!user) {
      return done(null, false, { message: '아이디가 없는데요?' });
    }

    // 비밀번호 대조 (지금은 평문으로 비교, 나중에 암호화 배울 거예요!)
    if (user.password === inputPassword) {
      return done(null, user);
    } else {
      return done(null, false, { message: '비번이 틀렸어요!' });
    }
  } catch (err) {
    return done(err);
  }
}));

// [4] 로그인 성공 후 세션 저장 방식
passport.serializeUser((user: any, done) => {
  done(null, user._id); // 유저의 ID만 세션에 저장 (용량 아끼기)
});

// [5] 페이지 방문 시마다 세션 확인
passport.deserializeUser(async (id: string, done) => {
  const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
  done(null, user); // 이제 모든 라우터에서 req.user로 유저 정보를 꺼낼 수 있음!
});


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

// --- login ---

// [GET] 로그인 페이지 보여주기
app.get('/login', (req, res) => {
  res.render('login.ejs');
});

// [POST] 로그인 버튼 눌렀을 때 실행되는 문지기 출동!
app.post('/login', passport.authenticate('local', {
  successRedirect: '/list',  // 로그인 성공 시 이동할 곳
  failureRedirect: '/login', // 로그인 실패 시 다시 로그인 페이지로
}));


function is_logined(req: any, res: any, next: any) {
    if (req.isAuthenticated()) {
        // 로그인 상태라면? "다음 단계(라우터)로 통과!"
        return next();
    }
    // 로그인 안 된 상태라면? "로그인 페이지로 쫓아내기"
    res.redirect('/login');
}


// ===== routing =====

// === home page routing ===

app.get('/', (req: Request, res: Response) => {
    res.sendFile(__dirname + '/index.html');
});


// === list page routing ===

app.get('/list', is_logined, async (req: Request, res: Response) => {

    const page = parseInt(req.query.page as string) || 1; // 현재 페이지 번호
    const limit = 3;

    try {
        // 'posts' 컬렉션의 모든 데이터를 찾아서 배열로 변환
        const totalPosts = await db.collection('posts').countDocuments({ isDeleted: { $ne: true } });
        const totalPages = Math.ceil(totalPosts / limit);

        const result = await db.collection('posts')
            .find({ isDeleted: { $ne: true } , writerId: req.user._id }) 
            .skip((page - 1) * limit) // pagenation: 건너뛸 문서 수 계산
            .limit(limit) // pagenation: 한 번에 가져올 문서 수 제한
            .toArray();
        
        // 브라우저에 list.ejs 파일을 보내는데, DB 데이터를 'posts'라는 이름으로 담아서 보냄
        res.render('list.ejs', { posts: result, currentPage: page, totalPages: totalPages });
    } catch (err) {
        console.error(err);
        res.status(500).send('데이터 조회 중 에러 발생');
    }
});



// === write page routing ===

app.get('/write', is_logined, (req: Request, res: Response) => {
    res.render('write.ejs');
});


app.post('/add', is_logined, async (req: Request, res: Response) => {
    // 1. 브라우저가 보낸 데이터가 잘 왔는지 확인
    console.log(req.body);
    try {
        // 2. db posts 컬렉션에 집어넣기
        await db.collection('posts').insertOne({
            title: req.body.title,
            content: req.body.content,
            dueDate: req.body.dueDate,
            writerId: req.user._id,
            writerName: req.user.username,
            createdAt: new Date(),
            isDeleted: false   
        });
        res.redirect('/list');
    } catch (e) {
        console.log(e);
        res.status(500).send('서버에러 발생')
    }
});


// === edit page routing ===

app.get('/edit/:id', is_logined, async (req: Request, res: Response) => {
    try {
        const targetId = req.params.id;
        const data = await db.collection('posts').findOne({_id: new ObjectId(targetId)});
        res.render('edit.ejs', { data : data });
    } catch (e) {
        console.log(e);
        res.status(500).send('서버에러 발생')
    }
});


app.post('/edit/:id', is_logined, async (req: Request, res: Response) => {
    // 1. 브라우저가 보낸 데이터가 잘 왔는지 확인
    console.log(req.body);
    try {
        // 2. db posts 컬렉션에서 수정
        await db.collection('posts').updateOne(
            { _id: new ObjectId(req.params.id) },
            {
                $set: {
                    title: req.body.title,
                    content: req.body.content,
                    dueDate: req.body.dueDate,
                    createdAt: new Date(),
                    isDeleted: false
                }
            }
        );
        res.redirect('/list');
    } catch (e) {
        console.log(e);
        res.status(500).send('서버에러 발생')
    }
});




// === detail page routing ===

app.get("/detail/:id", is_logined, async (req: Request, res: Response) => {
    
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



app.delete('/delete/:id', is_logined, async (req: Request, res: Response) => {
    try {
        await db.collection('posts').updateOne(
            {_id: new ObjectId(req.params.id)},
            {$set: { isDeleted: true } }
        );
    res.json({ message: '삭제 성공!'})
    } catch (e) {
        console.log(e);
        res.status(500).send('서버에러 발생')
    }
});

/*
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
});

*/
