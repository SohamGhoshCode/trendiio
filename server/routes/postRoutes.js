 import express from 'express'
import { upload } from '../configs/multer.js'
import { protect } from '../middlewares/auth.js'
import { addPost, getFeedPost, likePost } from '../controllers/postController.js'
 

 const postRouter = express.Router()

 postRouter.post('/add', protect, upload.array('images', 4), addPost)
 postRouter.get('/feed', protect, getFeedPost)
 postRouter.post('/like', protect, likePost)

 export default postRouter

