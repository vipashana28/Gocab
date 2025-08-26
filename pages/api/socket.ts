import { NextApiRequest } from 'next'
import { NextApiResponseServerIO, initializeSocketIO } from '@/lib/socket-server'

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    if (res.socket.server.io) {
      console.log('Socket.io server already running')
    } else {
      console.log('Initializing Socket.io server...')
      
      const io = initializeSocketIO(res.socket.server)
      res.socket.server.io = io
      
      console.log('Socket.io server initialized successfully')
    }
    
    res.status(200).json({ success: true, message: 'Socket.io initialized' })
  } catch (error) {
    console.error('Socket.io initialization error:', error)
    res.status(500).json({ error: 'Failed to initialize Socket.io' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
