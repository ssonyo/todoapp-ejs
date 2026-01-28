import express, { Request, Response } from 'express';
import { ObjectId, Db } from 'mongodb';

const router = express.Router();

// 🔒 이 라우터 파일의 모든 경로에 적용될 미들웨어
function is_logined(req: any, res: any, next: any) {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/login');
}
router.use(is_logined); 

// Helper: DB 가져오기
const getDB = (req: Request): Db => req.app.get('db');

// [GET] /post/list (내 글만 보기)
router.get('/list', async (req: Request, res: Response) => {
    const db = getDB(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = 3;

    try {
        const query = { isDeleted: { $ne: true }, writerId: req.user!._id };
        const totalPosts = await db.collection('posts').countDocuments(query);
        const totalPages = Math.ceil(totalPosts / limit);

        const result = await db.collection('posts')
            .find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        res.render('list.ejs', { posts: result, currentPage: page, totalPages: totalPages });
    } catch (err) {
        res.status(500).send('데이터 조회 에러');
    }
});

// [POST] /post/add
router.post('/add', async (req: Request, res: Response) => {
    const db = getDB(req);
    try {
        await db.collection('posts').insertOne({
            title: req.body.title,
            content: req.body.content,
            dueDate: req.body.dueDate,
            writerId: req.user!._id,
            writerName: req.user!.username,
            createdAt: new Date(),
            isDeleted: false
        });
        res.redirect('/post/list');
    } catch (e) {
        res.status(500).send('저장 에러');
    }
});

// [GET] /post/write (AJAX)
router.get('/write', (req: Request, res: Response) => {
    res.render('write.ejs');
});


// [GET] /post/detail/:id
router.get('/detail/:id', async (req: Request, res: Response) => {
    const db = getDB(req);
    const data = await db.collection('posts').findOne({ _id: new ObjectId(req.params.id) });
    res.render('detail.ejs', { data });
});

// [GET] /post/edit/:id
router.get('/edit/:id', async (req: Request, res: Response) => {
    const db = getDB(req);
    const data = await db.collection('posts').findOne({ _id: new ObjectId(req.params.id) });
    res.render('edit.ejs', { data });
});

// [POST] /post/edit/:id
router.post('/edit/:id', async (req: Request, res: Response) => {
    const db = getDB(req);
    await db.collection('posts').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { title: req.body.title, content: req.body.content, dueDate: req.body.dueDate } }
    );
    res.redirect('/post/list');
});

// [DELETE] /post/delete/:id
router.delete('/delete/:id', async (req: Request, res: Response) => {
    const db = getDB(req);
    await db.collection('posts').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isDeleted: true } }
    );
    res.json({ message: '삭제 성공' });
});

export default router;