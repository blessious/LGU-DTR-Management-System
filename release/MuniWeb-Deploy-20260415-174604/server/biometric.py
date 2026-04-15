import zk
import threading

class Biometric(zk.ZK):
    def __init__(self, ip:str, port:str|int, timeout:int = 10, name:str = ''):
        '''
        Initialize a biometric object
        '''
        super().__init__(ip = ip, port = int(port), timeout = timeout, password = 0, force_udp = False, ommit_ping = False)
        self.name = name
        self.ip = ip
        try:
            self.connect()
        except Exception as e:
            print ("Process terminate : {}".format(e))
        self.__thread_enabled = False
        self.__stop_flag = False

    def listen(self, on_success_callback = None, on_failure_callback = None, use_thread:bool = False,):
        '''
        Listen for events

        If `use_thread` is True, start the process on another tread, otherwise blocks proceeding codes \n
        `on_success_callback` -  function to execute on success. Passes an Attendance object. See pyzk for docs \n
        `on_failure_callback` - function to execute on failure. Default to pass
        '''
        if use_thread:
            self.__thread_enabled = True
        self.on_success_callback = on_success_callback
        self.on_failure_callback = on_failure_callback
        if use_thread:
            thread = threading.Thread(target = self.__thread_listen)
            thread.start()
        else:
            self.__thread_listen()

    def __thread_listen(self):
        '''
        Zk function for live capture
        '''
        for attendance in self.live_capture():
            if self.__thread_enabled and self.__stop_flag:
                self.__thread_enabled = False
                self.__stop_flag = False
                break
            if not self.__thread_enabled and self.__stop_flag:
                self.__stop_flag = False
                break
            if attendance is None:
                if self.on_failure_callback:
                    self.on_failure_callback()
            else:
                if self.on_success_callback:
                    self.on_success_callback(attendance)
                else:
                    pass

    def stop_listen_on_thread(self):
        '''
        Stop the listening thread

        Only used when listening using thread \n
        Raises an exception if use_thread is False
        '''
        if not self.__thread_enabled:
            raise Exception('Listening thread has not started')
        
        self.__stop_flag = True
    
    def stop_listen(self):
        '''
        Stop listening for events
        '''
        self.__stop_flag = True