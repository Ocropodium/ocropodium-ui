#!/bin/bash -e

BASEPATH=/home/michaelb/webapps
APPNAME=ocradmin
MASTER=ocr1
HOSTS=(ocr1 zino)



exportcmd="rsync -avlC . ${MASTER}:${BASEPATH}/${APPNAME}/"
chmodcmd="chmod 777 ${BASEPATH}/${APPNAME}"

i=0
while [ $i -lt ${#HOSTS[*]} ]; do
    host=${HOSTS[$i]}
    echo Running on $host
    rsync -avlC --exclude media --exclude log --exclude *.pyc . $host:$BASEPATH/$APPNAME/
    ssh $host "cd ${BASEPATH}; ${chmodcmd};"

    if [ $host = $MASTER ]; then
        echo $host is master
        ssh $host "cd ${BASEPATH}/${APPNAME} ; python manage.py syncdb"
        #ssh $host "sudo /etc/init.d/apache2 restart ; sudo /etc/init.d/celerybeat reload"
    fi

    ssh $host "sudo /etc/init.d/celeryd reload"
    i=`expr $i + 1`
done
