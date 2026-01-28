import express from 'express';
import { MongoClient, Db, ObjectId } from 'mongodb';
import passport from 'passport';
import session from 'express-session';
import { Strategy as LocalStrategy } from 'passport-local';

// 라우터 임포트
import authRouter from './routes/auth';
import postRouter from './routes/post';

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. 세션 및 패스포트 설정
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// 2. 모든 EJS에서 user 변수를 쓸 수 있게 설정 (전역 미들웨어)
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

// 3. DB 연결 및 라우터 연결
let db: Db;
const url = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(url);

async function startServer() {
    await client.connect();
    db = client.db('todoapp');
    app.set('db', db); // 라우터들이 쓸 수 있게 DB 저장

    // 패스포트 전략 설정 (간소화)
    passport.use(new LocalStrategy(async (u, p, done) => {
        const user = await db.collection('users').findOne({ username: u });
        if (!user || user.password !== p) return done(null, false);
        return done(null, user);
    }));

    passport.serializeUser((user: any, done) => done(null, user._id));
    passport.deserializeUser(async (id: string, done) => {
        const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
        done(null, user);
    });

    // 🔗 라우터 연결
    app.use('/auth', authRouter); // /auth/login, /auth/logout
    app.use('/post', postRouter); // /post/list, /post/add ...

    app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}

startServer();