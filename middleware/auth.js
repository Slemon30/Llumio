import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({status : "Failed", statusCode: 401, message: "Unauthorized"});
        }

        const decodedToken = jwt.verify(token, process.env.JWT_TOKEN);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.log(`Error in verifying token ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed", statusCode: 500, message: error.message});
    }
}

export default verifyToken;